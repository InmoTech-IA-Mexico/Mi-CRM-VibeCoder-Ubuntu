"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { OAuth2Client } from "google-auth-library";

// OAuth de Google (JUA-40) — verificación del ID token en runtime Node. Verifica en
// SERVIDOR firma (JWKS de Google), `iss`, `aud` (= GOOGLE_CLIENT_ID del entorno; nunca
// una audiencia del navegador), `exp`, `email_verified === true`, `sub` no vacío y el
// claim `nonce`. La lógica del CRM (consumir nonce, resolver por `sub`, sesión/vínculo)
// vive en `google.ts`. No se registran el token, el payload, el `sub` ni el email.

const client = new OAuth2Client();

/**
 * Verifica el ID token y comprueba el nonce. Devuelve `sub` + `expiraEn` (= `exp` del
 * token, ms), o null (rechazo genérico). `expiraEn` se usa para purgar el nonce consumido
 * cuando el token ya no es válido.
 */
async function verificar(idToken: string, nonce: string): Promise<{ sub: string; expiraEn: number } | null> {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) throw new Error("Falta GOOGLE_CLIENT_ID en el entorno de Convex");
  try {
    const ticket = await client.verifyIdToken({ idToken, audience });
    const p = ticket.getPayload();
    if (!p || p.email_verified !== true || !p.sub || p.nonce !== nonce || !p.exp) return null;
    return { sub: p.sub, expiraEn: p.exp * 1000 };
  } catch {
    return null; // firma / iss / exp inválidos
  }
}

/**
 * Inicia sesión con Google (JUA-40): verifica el ID token + nonce y delega el consumo
 * atómico del nonce + la creación de sesión (por `googleSub`). Error genérico ante
 * cualquier fallo (no revela si el email existe, está inactivo o sin vincular).
 */
export const iniciarSesionGoogle = action({
  args: { idToken: v.string(), nonce: v.string() },
  handler: async (ctx, { idToken, nonce }): Promise<{ token: string }> => {
    const ver = await verificar(idToken, nonce);
    if (!ver) throw new ConvexError("No pudimos iniciar sesión con Google.");
    const r: { ok: boolean; token?: string } = await ctx.runMutation(internal.google.consumirNonceLoginGoogle, {
      nonce,
      sub: ver.sub,
      expiraEn: ver.expiraEn,
    });
    if (!r.ok || !r.token) throw new ConvexError("No pudimos iniciar sesión con Google.");
    return { token: r.token };
  },
});

/**
 * Vincula la cuenta de Google al usuario de la sesión actual (JUA-40): requiere sesión
 * válida (prueba de control), verifica el ID token + nonce de vínculo y fija `googleSub`
 * de forma atómica (rechaza si el `sub` ya es de otro usuario). Error genérico.
 */
export const vincularGoogle = action({
  args: { token: v.string(), idToken: v.string(), nonce: v.string() },
  handler: async (ctx, { token, idToken, nonce }): Promise<{ ok: true }> => {
    const sesion: { usuarioId: Id<"usuarios"> } | null = await ctx.runQuery(internal.google.sesionUsuarioId, { token });
    if (!sesion) throw new ConvexError("No autorizado");
    const ver = await verificar(idToken, nonce);
    if (!ver) throw new ConvexError("No pudimos vincular tu cuenta de Google.");
    const r: { ok: boolean } = await ctx.runMutation(internal.google.consumirNonceVincular, {
      nonce,
      usuarioId: sesion.usuarioId,
      sub: ver.sub,
      expiraEn: ver.expiraEn,
    });
    if (!r.ok) throw new ConvexError("No pudimos vincular tu cuenta de Google.");
    return { ok: true };
  },
});
