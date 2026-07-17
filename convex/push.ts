import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { resolverSesion } from "./auth";

// Límites de saneamiento (JUA-33, obs. OBS-2): el endpoint es una URL HTTPS del
// push service; las claves son base64url cortas. Se acota tamaño y nº de
// dispositivos por usuario (evictando el más antiguo) para evitar abuso.
const ENDPOINT_MAX = 2048;
const CLAVE_MAX = 300;
const MAX_DISPOSITIVOS = 20;

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

    // Saneamiento (obs. OBS-2): endpoint HTTPS acotado + claves no vacías y cortas.
    if (!endpoint.startsWith("https://") || endpoint.length > ENDPOINT_MAX) {
      throw new Error("Suscripción no válida");
    }
    if (!p256dh || p256dh.length > CLAVE_MAX || !auth || auth.length > CLAVE_MAX) {
      throw new Error("Suscripción no válida");
    }

    // Upsert por endpoint: reasigna el endpoint al usuario de la sesión (clave del
    // fix B-1: al cambiar de cuenta en el mismo navegador, el endpoint pasa a ser
    // del usuario actual). Refresca las claves (el navegador puede rotarlas).
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

    // Tope de dispositivos por usuario: si se alcanza, evicta el más antiguo.
    const propias = await ctx.db
      .query("pushSubscriptions")
      .withIndex("por_usuario", (q) => q.eq("usuarioId", sesion.usuario._id))
      .collect();
    if (propias.length >= MAX_DISPOSITIVOS) {
      const masAntigua = propias.sort((a, b) => a.creadoEn - b.creadoEn)[0];
      if (masAntigua) await ctx.db.delete(masAntigua._id);
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

/** Nº de dispositivos (suscripciones) del propio usuario de la sesión. */
export const misDispositivos = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return 0;
    const subs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("por_usuario", (q) => q.eq("usuarioId", sesion.usuario._id))
      .collect();
    return subs.length;
  },
});

// ---- Internos para el emisor (action Node en pushEnvio.ts, JUA-33 Fase B) ----

/** Resuelve la sesión y devuelve el usuario/negocio, o null. (Uso interno.) */
export const usuarioDeSesion = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    return sesion ? { usuarioId: sesion.usuario._id, negocioId: sesion.negocioId } : null;
  },
});

/** Suscripciones de un usuario (endpoint + claves) para enviarle push. Interno. */
export const subsDeUsuario = internalQuery({
  args: { usuarioId: v.id("usuarios") },
  handler: async (ctx, { usuarioId }) => {
    const subs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("por_usuario", (q) => q.eq("usuarioId", usuarioId))
      .collect();
    return subs.map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }));
  },
});

/**
 * Borra una suscripción caducada (404/410) por su endpoint. Interno. Condicional
 * por dueño (obs. OBS-1): solo borra si la fila SIGUE siendo del usuario que la
 * leyó el emisor, evitando una carrera en la que el endpoint se reasignó a otro
 * usuario entre la lectura y la respuesta de error.
 */
export const borrarPorEndpoint = internalMutation({
  args: { endpoint: v.string(), usuarioId: v.id("usuarios") },
  handler: async (ctx, { endpoint, usuarioId }) => {
    const s = await ctx.db
      .query("pushSubscriptions")
      .withIndex("por_endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    if (s && s.usuarioId === usuarioId) await ctx.db.delete(s._id);
  },
});
