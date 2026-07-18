import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { resolverSesion } from "./auth";
import { prefFrioEfectiva } from "./inactividad";

// Límites de saneamiento (JUA-33, obs. OBS-2): el endpoint es una URL HTTPS del
// push service; las claves son base64url cortas. Se acota tamaño y nº de
// dispositivos por usuario (evictando el más antiguo) para evitar abuso.
const ENDPOINT_MAX = 2048;
const CLAVE_MAX = 300;
const MAX_DISPOSITIVOS = 20;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** Valida una suscripción (obs. OBS-1): endpoint URL HTTPS acotada + claves base64url cortas. */
function suscripcionValida(endpoint: string, p256dh: string, auth: string): boolean {
  if (endpoint.length > ENDPOINT_MAX) return false;
  try {
    if (new URL(endpoint).protocol !== "https:") return false;
  } catch {
    return false;
  }
  if (!p256dh || p256dh.length > CLAVE_MAX || !BASE64URL.test(p256dh)) return false;
  if (!auth || auth.length > CLAVE_MAX || !BASE64URL.test(auth)) return false;
  return true;
}

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

    if (!suscripcionValida(endpoint, p256dh, auth)) throw new Error("Suscripción no válida");

    // Upsert por endpoint: reasigna el endpoint al usuario de la sesión (clave del
    // fix B-1: al cambiar de cuenta en el mismo navegador, el endpoint pasa a ser
    // del usuario actual). Refresca las claves (el navegador puede rotarlas).
    const existente = await ctx.db
      .query("pushSubscriptions")
      .withIndex("por_endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    let id;
    if (existente) {
      // Re-suscribir reinicia el contador de fallos de red (obs. OBS-1): una sub que
      // vuelve a registrarse no debe heredar fallos antiguos y podarse al primer error.
      await ctx.db.patch(existente._id, { usuarioId: sesion.usuario._id, negocioId: sesion.negocioId, p256dh, auth, fallosRed: 0 });
      id = existente._id;
    } else {
      id = await ctx.db.insert("pushSubscriptions", {
        usuarioId: sesion.usuario._id,
        negocioId: sesion.negocioId,
        endpoint,
        p256dh,
        auth,
        creadoEn: Date.now(),
      });
    }

    // Tope de dispositivos por usuario (obs. OBS-1): se aplica DESPUÉS de insertar o
    // reasignar; evicta las más antiguas del usuario, nunca la que se acaba de fijar.
    const propias = await ctx.db
      .query("pushSubscriptions")
      .withIndex("por_usuario", (q) => q.eq("usuarioId", sesion.usuario._id))
      .collect();
    if (propias.length > MAX_DISPOSITIVOS) {
      const evictables = propias.filter((s) => s._id !== id).sort((a, b) => a.creadoEn - b.creadoEn);
      let sobran = propias.length - MAX_DISPOSITIVOS;
      for (const s of evictables) {
        if (sobran <= 0) break;
        await ctx.db.delete(s._id);
        sobran--;
      }
    }
    return id;
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

const PREF_V = v.union(v.literal("ninguna"), v.literal("cartera"), v.literal("pool"), v.literal("negocio"));

/** Preferencia de alertas de cliente frío del propio usuario (JUA-33 B-2), con su rol. */
export const miPreferenciaFrio = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return null;
    // Misma regla que el encolado/revalidación (fuente única `prefFrioEfectiva`): el
    // observador queda en "ninguna" (obs. no bloqueante del dictamen B-1/B-2).
    return { rol: sesion.usuario.rol, pref: prefFrioEfectiva(sesion.usuario.rol, sesion.usuario.prefClienteFrio) };
  },
});

/** Guarda la preferencia de alertas de cliente frío del usuario de la sesión. */
export const guardarPreferenciaFrio = mutation({
  args: { token: v.string(), pref: PREF_V },
  handler: async (ctx, { token, pref }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) throw new Error("No autorizado");
    // El observador (solo lectura) no tiene cartera ni recibe alertas de gestión.
    const permitida =
      sesion.usuario.rol === "admin"
        ? ["ninguna", "pool", "negocio"]
        : sesion.usuario.rol === "operativo"
          ? ["ninguna", "cartera"]
          : ["ninguna"];
    if (!permitida.includes(pref)) throw new Error("Preferencia no válida para el rol");
    await ctx.db.patch(sesion.usuario._id, { prefClienteFrio: pref });
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

/** Suscripciones de un usuario (id + endpoint + claves) para enviarle push. Interno. */
export const subsDeUsuario = internalQuery({
  args: { usuarioId: v.id("usuarios") },
  handler: async (ctx, { usuarioId }) => {
    const subs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("por_usuario", (q) => q.eq("usuarioId", usuarioId))
      .collect();
    return subs.map((s) => ({ id: s._id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, fallosRed: s.fallosRed ?? 0 }));
  },
});

// Poda de suscripciones muertas por fallos de RED consecutivos (JUA-127). Un fallo
// sin código HTTP (statusCode indefinido, no 404/410) puede ser un corte pasajero;
// solo tras MAX_FALLOS_RED consecutivos se considera muerta y se poda. Las condiciones
// (id + usuarioId + p256dh) evitan actuar sobre una fila reasignada o con claves rotadas.
const MAX_FALLOS_RED = 3;

/**
 * Procesa el fallo de un envío SEGÚN el código de respuesta del push service, en una
 * sola mutación (clasificación testeable, obs. B-1). Condicional por id+usuarioId+p256dh
 * (no actúa sobre una fila reasignada o con claves rotadas). Clasificación:
 *  - `404`/`410` → suscripción caducada: se **borra** (`resultado:"caducada"`).
 *  - **sin `statusCode`** (error de RED, sin respuesta HTTP) → cuenta consecutivos y, al
 *    `MAX_FALLOS_RED`.º, **poda** la sub muerta (`"podada"`); si no, `"red"`.
 *  - **cualquier otra respuesta HTTP** (429, 5xx, 401, 403…) → hubo conectividad, así que
 *    NO se poda: se **reinicia** el contador de red (para que "consecutivos" sea literal) y
 *    se trata como transitorio (`"http"`). Así un 401/403 por config VAPID no poda subs sanas.
 * El emisor cuenta `caducada`/`podada` como caducadas (sin reintento) y `red`/`http` como
 * fallidas (la notificación reintenta con backoff).
 */
export const procesarFalloEnvio = internalMutation({
  args: {
    id: v.id("pushSubscriptions"),
    usuarioId: v.id("usuarios"),
    p256dh: v.string(),
    statusCode: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { id, usuarioId, p256dh, statusCode },
  ): Promise<{ resultado: "caducada" | "podada" | "red" | "http" }> => {
    const s = await ctx.db.get(id);
    if (!s || s.usuarioId !== usuarioId || s.p256dh !== p256dh) return { resultado: "http" };

    if (statusCode === 404 || statusCode === 410) {
      await ctx.db.delete(id); // el endpoint ya no existe
      return { resultado: "caducada" };
    }
    if (statusCode === undefined) {
      // Error de RED (sin respuesta HTTP): cuenta consecutivos; poda la sub muerta al 3.º.
      const fallos = (s.fallosRed ?? 0) + 1;
      if (fallos >= MAX_FALLOS_RED) {
        await ctx.db.delete(id);
        return { resultado: "podada" };
      }
      await ctx.db.patch(id, { fallosRed: fallos });
      return { resultado: "red" };
    }
    // Otra respuesta HTTP: hubo conectividad → NO podar; reinicia la racha de red.
    if ((s.fallosRed ?? 0) > 0) await ctx.db.patch(id, { fallosRed: 0 });
    return { resultado: "http" };
  },
});

/** Reinicia el contador de fallos de red tras un envío con éxito (solo si venía >0). Interno. */
export const resetFalloRed = internalMutation({
  args: { id: v.id("pushSubscriptions"), usuarioId: v.id("usuarios"), p256dh: v.string() },
  handler: async (ctx, { id, usuarioId, p256dh }) => {
    const s = await ctx.db.get(id);
    if (s && s.usuarioId === usuarioId && s.p256dh === p256dh && (s.fallosRed ?? 0) > 0) {
      await ctx.db.patch(id, { fallosRed: 0 });
    }
  },
});

