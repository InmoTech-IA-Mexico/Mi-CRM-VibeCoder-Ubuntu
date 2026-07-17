import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { resolverSesion } from "./auth";

// Suscripciones Web Push (JUA-33). El envío real (action Node con web-push +
// VAPID) y el disparo automático llegan en fases posteriores; aquí solo se
// gestiona la suscripción del dispositivo, con permiso explícito del usuario.

/**
 * Registra (o actualiza) la suscripción push del dispositivo actual. Se
 * identifica por su `endpoint` único: si ya existe, se reasigna al usuario de la
 * sesión y se refrescan las claves (el navegador puede rotarlas). Requiere sesión
 * válida; cualquier rol puede suscribirse (incluido el observador: recibir avisos
 * no es escribir datos del CRM).
 */
export const guardarSubscription = mutation({
  args: {
    token: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  handler: async (ctx, { token, endpoint, p256dh, auth }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const existente = await ctx.db
      .query("pushSubscriptions")
      .withIndex("por_endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    if (existente) {
      await ctx.db.patch(existente._id, {
        usuarioId: sesion.usuario._id,
        negocioId: sesion.negocioId,
        p256dh,
        auth,
      });
      return existente._id;
    }
    return await ctx.db.insert("pushSubscriptions", {
      usuarioId: sesion.usuario._id,
      negocioId: sesion.negocioId,
      endpoint,
      p256dh,
      auth,
      creadoEn: Date.now(),
    });
  },
});

/**
 * Elimina la suscripción del dispositivo actual (al desactivar el aviso). Solo
 * borra si la suscripción pertenece al usuario de la sesión (defensa: un endpoint
 * no puede borrar el de otro usuario).
 */
export const borrarSubscription = mutation({
  args: { token: v.string(), endpoint: v.string() },
  handler: async (ctx, { token, endpoint }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const existente = await ctx.db
      .query("pushSubscriptions")
      .withIndex("por_endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    if (existente && existente.usuarioId === sesion.usuario._id) {
      await ctx.db.delete(existente._id);
    }
  },
});
