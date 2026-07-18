import { query, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { resolverSesion } from "./auth";

// OAuth de Google (JUA-40) — parte SIN Node: registro de nonces consumidos (anti-replay),
// resolución por `googleSub` y creación de sesión / vínculo. La VERIFICACIÓN del ID token
// (firma, aud, iss, exp, email_verified, nonce) vive en la action `"use node"`
// (`googleAction.ts`); aquí solo entra un `sub` YA verificado.
//
// Anti-replay SIN emisión pública de nonces (obs. B-1): el nonce lo genera el CLIENTE y
// viaja en el ID token; se registra como consumido SOLO tras verificar una credencial de
// Google válida. Así no hay ruta anónima que llenar (no existe un `emitirNonce` público).
// No se registran tokens, nonces, `sub` ni email en logs/consola/reportes.

const SESION_MS = 8 * 60 * 60 * 1000; // igual que auth.ts (8 h)
const PURGA_LOTE = 200;

/** Registra el nonce como consumido; devuelve `false` si ya lo estaba (replay). Atómico dentro de la mutación. */
async function registrarNonce(ctx: MutationCtx, nonce: string, expiraEn: number): Promise<boolean> {
  const ya = await ctx.db.query("noncesConsumidos").withIndex("por_nonce", (q) => q.eq("nonce", nonce)).first();
  if (ya) return false;
  await ctx.db.insert("noncesConsumidos", { nonce, expiraEn });
  return true;
}

/**
 * Login con Google (JUA-40): registra el nonce (anti-replay) y crea la sesión, en UNA
 * mutación (atómico). Recibe el `sub` YA verificado por la action. Resuelve por `googleSub`
 * (no por email); solo usuario ACTIVO. `ok:false` genérico ante cualquier fallo (replay,
 * sin vínculo, inactivo).
 */
export const consumirNonceLoginGoogle = internalMutation({
  args: { nonce: v.string(), sub: v.string(), expiraEn: v.number() },
  handler: async (ctx, { nonce, sub, expiraEn }): Promise<{ ok: boolean; token?: string }> => {
    if (!sub) return { ok: false };
    if (!(await registrarNonce(ctx, nonce, expiraEn))) return { ok: false }; // replay
    const usuario = await ctx.db.query("usuarios").withIndex("por_google_sub", (q) => q.eq("googleSub", sub)).first();
    if (!usuario || usuario.estado !== "activo") return { ok: false };
    const ahora = Date.now();
    const token = bytesToHex(randomBytes(32));
    await ctx.db.insert("sesiones", { usuarioId: usuario._id, negocioId: usuario.negocioId, token, expiraEn: ahora + SESION_MS });
    await ctx.db.patch(usuario._id, { ultimoAcceso: ahora });
    return { ok: true, token };
  },
});

/**
 * Vincula Google al usuario `usuarioId` (la action ya validó su sesión = prueba de
 * control): registra el nonce (anti-replay) y fija `googleSub` con unicidad global, en
 * una mutación (atómico). Rechaza si el `sub` ya es de otro usuario.
 */
export const consumirNonceVincular = internalMutation({
  args: { nonce: v.string(), usuarioId: v.id("usuarios"), sub: v.string(), expiraEn: v.number() },
  handler: async (ctx, { nonce, usuarioId, sub, expiraEn }): Promise<{ ok: boolean }> => {
    if (!sub) return { ok: false };
    if (!(await registrarNonce(ctx, nonce, expiraEn))) return { ok: false }; // replay
    const usuario = await ctx.db.get(usuarioId);
    if (!usuario || usuario.estado !== "activo") return { ok: false };
    const dueno = await ctx.db.query("usuarios").withIndex("por_google_sub", (q) => q.eq("googleSub", sub)).first();
    if (dueno && dueno._id !== usuarioId) return { ok: false }; // el sub ya es de otro
    await ctx.db.patch(usuarioId, { googleSub: sub });
    return { ok: true };
  },
});

/** ¿La cuenta del usuario de la sesión tiene Google vinculado? (para el Perfil, JUA-40). No expone el `sub`. */
export const estadoVinculo = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return null;
    return { vinculado: !!sesion.usuario.googleSub };
  },
});

/** Resuelve la sesión → usuarioId (para la action de vínculo). Interno. */
export const sesionUsuarioId = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    return sesion ? { usuarioId: sesion.usuario._id } : null;
  },
});

/** Purga programada de nonces consumidos ya expirados (cron, JUA-40). El token asociado ya no es válido. */
export const purgarNoncesExpirados = internalMutation({
  args: {},
  handler: async (ctx) => {
    const viejos = await ctx.db
      .query("noncesConsumidos")
      .withIndex("por_expira", (q) => q.lte("expiraEn", Date.now()))
      .take(PURGA_LOTE);
    for (const n of viejos) await ctx.db.delete(n._id);
    return { purgados: viejos.length };
  },
});

// --- Helpers SOLO para pruebas (dev), gateados por QA_HELPERS (inertes en prod) ------

/** Marca un nonce consumido como expirado (para probar la purga). Solo pruebas. */
export const qaExpirarNonce = internalMutation({
  args: { nonce: v.string() },
  handler: async (ctx, { nonce }) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    const n = await ctx.db.query("noncesConsumidos").withIndex("por_nonce", (q) => q.eq("nonce", nonce)).first();
    if (n) await ctx.db.patch(n._id, { expiraEn: 0 });
  },
});

/** Desvincula Google de un usuario (limpieza de pruebas). Solo pruebas. */
export const qaLimpiarGoogle = internalMutation({
  args: { usuarioId: v.id("usuarios") },
  handler: async (ctx, { usuarioId }) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    await ctx.db.patch(usuarioId, { googleSub: undefined });
  },
});
