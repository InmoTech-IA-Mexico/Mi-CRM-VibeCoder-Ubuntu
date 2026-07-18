import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { hashPassword } from "./auth";
import { encolar } from "./emailCola";

// Recuperación de contraseña (JUA-7). Funciones PÚBLICAS: el usuario no tiene
// sesión (olvidó su clave). Token de un solo uso, expira en 24 h; solicitar de
// nuevo invalida el anterior. Nunca se revela si un email existe (anti-enumeración).
// El envío real del enlace por email queda pendiente (Resend).

const RECUP_MS = 24 * 60 * 60 * 1000; // 24 h
const THROTTLE_MS = 60 * 1000; // no reemitir enlace si hay uno reciente (< 60 s)

/**
 * Solicita un enlace de recuperación. Respuesta **genérica** siempre (exista o
 * no el email). Solo para usuario **activo con contraseña**. Invalida sus enlaces
 * previos y crea uno nuevo (24 h), salvo que exista uno reciente (throttle 60 s,
 * anti-abuso / anti-spam de correo).
 */
export const solicitar = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const correo = email.trim().toLowerCase();

    const usuario = await ctx.db
      .query("usuarios")
      .withIndex("por_email", (q) => q.eq("email", correo))
      .first();

    if (usuario && usuario.estado === "activo" && usuario.passwordHash) {
      const ahora = Date.now();
      const previos = await ctx.db
        .query("recuperaciones")
        .withIndex("por_usuario", (q) => q.eq("usuarioId", usuario._id))
        .collect();

      // Throttle: si ya hay un enlace vigente y muy reciente, no reemitir.
      const reciente = previos.some((p) => p.usadoEn == null && p._creationTime > ahora - THROTTLE_MS);
      if (!reciente) {
        // Invalidar enlaces previos (el anterior se invalida) y crear uno nuevo.
        for (const p of previos) await ctx.db.delete(p._id);
        const recuperacionId = await ctx.db.insert("recuperaciones", {
          usuarioId: usuario._id,
          token: bytesToHex(randomBytes(32)),
          expiraEn: ahora + RECUP_MS,
        });
        // Envía el enlace por correo (JUA-129). SOLO dentro de este bloque (usuario activo
        // con contraseña) → la respuesta pública sigue siendo genérica: no revela si el
        // email existe (anti-enumeración, obs. B-1). Entrega DURABLE (sin fallback copiable).
        await encolar(ctx, { tipo: "recuperacion", recuperacionId });
      }
    }

    // Respuesta genérica: no revela si el email existe.
    return { ok: true };
  },
});

/** Estado de un enlace de recuperación para la pantalla "Nueva contraseña". */
export const porToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const rec = await ctx.db
      .query("recuperaciones")
      .withIndex("por_token", (q) => q.eq("token", token))
      .first();
    if (!rec) return { estado: "invalida" as const };
    if (rec.usadoEn != null) return { estado: "usada" as const };
    if (rec.expiraEn <= Date.now()) return { estado: "expirada" as const };

    // Un usuario desactivado tras emitirse el enlace no puede usarlo.
    const usuario = await ctx.db.get(rec.usuarioId);
    if (!usuario || usuario.estado !== "activo") return { estado: "invalida" as const };
    return { estado: "valida" as const, email: usuario.email };
  },
});

/**
 * Fija la nueva contraseña desde un enlace válido. Un solo uso (marca `usadoEn`).
 * Además desbloquea la cuenta (resetea intentos/bloqueo). No crea sesión: el
 * usuario vuelve al Login.
 */
export const restablecer = mutation({
  args: { token: v.string(), password: v.string() },
  handler: async (ctx, { token, password }) => {
    const rec = await ctx.db
      .query("recuperaciones")
      .withIndex("por_token", (q) => q.eq("token", token))
      .first();
    if (!rec) throw new Error("Enlace no válido");
    if (rec.usadoEn != null) throw new Error("Este enlace ya se usó");
    if (rec.expiraEn <= Date.now()) throw new Error("El enlace ha expirado");
    if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

    // Un usuario desactivado tras emitirse el enlace no puede usarlo.
    const usuario = await ctx.db.get(rec.usuarioId);
    if (!usuario || usuario.estado !== "activo") throw new Error("Enlace no válido");

    await ctx.db.patch(usuario._id, {
      passwordHash: hashPassword(password),
      intentosFallidos: 0,
      bloqueadoHasta: undefined,
    });
    await ctx.db.patch(rec._id, { usadoEn: Date.now() });

    // Revocar todas las sesiones activas del usuario: si el reset fue por
    // sospecha de compromiso, cualquier sesión anterior deja de valer.
    const sesiones = await ctx.db
      .query("sesiones")
      .withIndex("por_usuario", (q) => q.eq("usuarioId", usuario._id))
      .collect();
    for (const s of sesiones) await ctx.db.delete(s._id);

    return { ok: true };
  },
});
