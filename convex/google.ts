import { mutation, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { resolverSesion } from "./auth";

// OAuth de Google (JUA-40) — parte SIN Node: emisión/consumo de nonces (anti-replay),
// resolución por `googleSub` y creación de sesión / vínculo. La VERIFICACIÓN del ID
// token (firma, aud, iss, exp, email_verified, nonce) vive en la action `"use node"`
// (`googleAction.ts`); aquí solo entra un `sub` YA verificado. No se registran tokens,
// nonces, sub ni email en logs, consola ni reportes.

const SESION_MS = 8 * 60 * 60 * 1000; // igual que auth.ts (8 h)
const NONCE_TTL_MS = 5 * 60 * 1000; // el nonce vive 5 min
const NONCE_VIVOS_MAX = 500; // tope de nonces VIVOS (anti-abuso de emisión anónima)
const PURGA_LOTE = 200;

/** Purga perezosa de nonces expirados (acota el crecimiento de la tabla). */
async function purgarExpirados(ctx: MutationCtx, ahora: number): Promise<void> {
  const viejos = await ctx.db
    .query("noncesLogin")
    .withIndex("por_expira", (q) => q.lte("expiraEn", ahora))
    .take(PURGA_LOTE);
  for (const n of viejos) await ctx.db.delete(n._id);
}

/**
 * Emite un nonce de un solo uso para el LOGIN por Google (anónimo). El frontend lo
 * pasa a Google Identity Services (viaja en el claim `nonce` del ID token) y el backend
 * lo verifica y consume una sola vez. Purga perezosa + tope de nonces vivos acotan el
 * abuso de emisión anónima; TTL corto (5 min).
 */
export const emitirNonceLogin = mutation({
  args: {},
  handler: async (ctx) => {
    const ahora = Date.now();
    await purgarExpirados(ctx, ahora);
    const vivos = await ctx.db
      .query("noncesLogin")
      .withIndex("por_expira", (q) => q.gt("expiraEn", ahora))
      .take(NONCE_VIVOS_MAX + 1);
    if (vivos.length > NONCE_VIVOS_MAX) throw new ConvexError("Demasiadas solicitudes. Inténtalo en un momento.");
    const nonce = bytesToHex(randomBytes(16));
    await ctx.db.insert("noncesLogin", { nonce, expiraEn: ahora + NONCE_TTL_MS, operacion: "login" });
    return { nonce };
  },
});

/**
 * Emite un nonce de un solo uso para VINCULAR Google a la cuenta de la sesión actual
 * (requiere sesión válida = prueba de control, JUA-40 B-2). Queda atado al `usuarioId`.
 */
export const emitirNonceVincular = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) throw new ConvexError("No autorizado");
    const ahora = Date.now();
    await purgarExpirados(ctx, ahora);
    const nonce = bytesToHex(randomBytes(16));
    await ctx.db.insert("noncesLogin", {
      nonce,
      expiraEn: ahora + NONCE_TTL_MS,
      operacion: "vincular",
      usuarioId: sesion.usuario._id,
    });
    return { nonce };
  },
});

/**
 * Consume el nonce de LOGIN y crea la sesión, ATÓMICAMENTE (JUA-40, control 2). Recibe
 * el `sub` ya verificado por la action. Resuelve el usuario por `googleSub` (no por
 * email); solo un usuario ACTIVO obtiene sesión. Devuelve `ok:false` (genérico) en
 * cualquier fallo (nonce inválido/expirado/otra operación, sin vínculo, inactivo).
 */
export const consumirNonceLoginGoogle = internalMutation({
  args: { nonce: v.string(), sub: v.string() },
  handler: async (ctx, { nonce, sub }): Promise<{ ok: boolean; token?: string }> => {
    const ahora = Date.now();
    const n = await ctx.db.query("noncesLogin").withIndex("por_nonce", (q) => q.eq("nonce", nonce)).first();
    if (!n || n.operacion !== "login" || n.expiraEn < ahora) return { ok: false };
    await ctx.db.delete(n._id); // consumo de un solo uso (previo a resolver → anti-replay)
    if (!sub) return { ok: false };
    const usuario = await ctx.db.query("usuarios").withIndex("por_google_sub", (q) => q.eq("googleSub", sub)).first();
    if (!usuario || usuario.estado !== "activo") return { ok: false };
    const token = bytesToHex(randomBytes(32));
    await ctx.db.insert("sesiones", { usuarioId: usuario._id, negocioId: usuario.negocioId, token, expiraEn: ahora + SESION_MS });
    await ctx.db.patch(usuario._id, { ultimoAcceso: ahora });
    return { ok: true, token };
  },
});

/**
 * Consume el nonce de VINCULAR y fija `googleSub` en el usuario de la sesión,
 * ATÓMICAMENTE (JUA-40, controles 2 y 5). Rechaza si el nonce no es de vínculo, no
 * corresponde a ese usuario, expiró, o el `sub` ya pertenece a OTRO usuario.
 */
export const consumirNonceVincular = internalMutation({
  args: { nonce: v.string(), usuarioId: v.id("usuarios"), sub: v.string() },
  handler: async (ctx, { nonce, usuarioId, sub }): Promise<{ ok: boolean }> => {
    const ahora = Date.now();
    const n = await ctx.db.query("noncesLogin").withIndex("por_nonce", (q) => q.eq("nonce", nonce)).first();
    if (!n || n.operacion !== "vincular" || n.usuarioId !== usuarioId || n.expiraEn < ahora) return { ok: false };
    await ctx.db.delete(n._id); // consumo de un solo uso
    if (!sub) return { ok: false };
    const usuario = await ctx.db.get(usuarioId);
    if (!usuario || usuario.estado !== "activo") return { ok: false };
    const dueno = await ctx.db.query("usuarios").withIndex("por_google_sub", (q) => q.eq("googleSub", sub)).first();
    if (dueno && dueno._id !== usuarioId) return { ok: false }; // el sub ya es de otro
    await ctx.db.patch(usuarioId, { googleSub: sub });
    return { ok: true };
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

/** Purga programada de nonces expirados (cron, JUA-40 control 3). */
export const purgarNoncesExpirados = internalMutation({
  args: {},
  handler: async (ctx) => {
    const viejos = await ctx.db
      .query("noncesLogin")
      .withIndex("por_expira", (q) => q.lte("expiraEn", Date.now()))
      .take(PURGA_LOTE);
    for (const n of viejos) await ctx.db.delete(n._id);
    return { purgados: viejos.length };
  },
});

// --- Helpers SOLO para pruebas (dev), gateados por QA_HELPERS (inertes en prod) ------

/** Expira un nonce (para probar el rechazo por expiración). Solo pruebas. */
export const qaExpirarNonce = internalMutation({
  args: { nonce: v.string() },
  handler: async (ctx, { nonce }) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    const n = await ctx.db.query("noncesLogin").withIndex("por_nonce", (q) => q.eq("nonce", nonce)).first();
    if (n) await ctx.db.patch(n._id, { expiraEn: 0 });
  },
});

/** Desvincula Google de un usuario y borra sus nonces (limpieza de pruebas). Solo pruebas. */
export const qaLimpiarGoogle = internalMutation({
  args: { usuarioId: v.id("usuarios") },
  handler: async (ctx, { usuarioId }) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    await ctx.db.patch(usuarioId, { googleSub: undefined });
    const ns = await ctx.db.query("noncesLogin").collect();
    for (const n of ns) if (n.usuarioId === usuarioId) await ctx.db.delete(n._id);
  },
});
