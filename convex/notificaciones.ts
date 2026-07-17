import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { partesLocales } from "./fechas";
import { recordatorioProximoIds, prefFrio } from "./inactividad";

// Cola de notificaciones push (JUA-33 Fase C, remediación B-3). El envío real lo
// hace la action Node `pushEnvio.flushNotificaciones`, que reclama un lote aquí,
// envía, y registra el resultado. Estas mutaciones son la parte DURABLE del
// protocolo: reclamación con lease, recuperación de leases vencidos, reintentos
// con backoff y estado terminal según el resultado real del emisor.

// Horario diurno del negocio para no enviar de noche (decisión de producto).
const HORA_INICIO = 9;
const HORA_FIN = 20; // [9:00, 20:00)
const LEASE_MS = 5 * 60 * 1000; // vigencia de una reclamación "enviando"
const MAX_INTENTOS = 3;
const LOTE_MAX = 50; // reclama por lotes (obs. escala)
const BACKOFF_MS = 30 * 60 * 1000; // reintento: intentos * 30 min

/** Ítem reclamado para enviar (id de la fila + datos del payload). */
export type Reclamo = {
  id: Id<"notificacionesPush">;
  usuarioId: Id<"usuarios">;
  clienteId: Id<"clientes">;
  nombre: string;
  intentos: number;
};

/**
 * Revalidación transaccional del destino (JUA-33, obs. B-1/B-2), en el momento del
 * envío (no en el de encolar). Respeta la AUDIENCIA materializada de la fila para no
 * mezclar destinatarios (el defecto del dictamen: una fila de admin se reasignaba al
 * responsable). Además revalida la preferencia VIGENTE del destinatario (opt-in de
 * B-2): si el usuario pasó a "ninguna" tras encolar, ya no se le envía. Descarta si
 * apareció un recordatorio próximo (≤3 días → ya hay seguimiento previsto).
 *
 * Por audiencia:
 *  - `responsable`: destino = el responsable ACTUAL del cliente (redirige si se
 *    reasignó), si está activo y su pref incluye su cartera ("cartera"/"negocio").
 *  - `admin_negocio`: el admin ORIGINAL, solo si sigue activo y con "negocio". Nunca
 *    se redirige al responsable.
 *  - `admin_pool`: el admin ORIGINAL, solo si el cliente sigue SIN asignar y el admin
 *    sigue activo y con "pool".
 * Devuelve el `usuarioId` vigente a notificar, o la razón de descarte.
 */
async function revalidarDestino(
  ctx: MutationCtx,
  n: Doc<"notificacionesPush">,
  cliente: Doc<"clientes">,
  ahora: number,
): Promise<{ ok: true; usuarioId: Id<"usuarios"> } | { ok: false; razon: string }> {
  // 1) Recordatorio próximo recalculado ahora (pudo crearse tras encolar) — aplica a
  //    todas las audiencias: si ya hay seguimiento previsto, el episodio sobra.
  const segs = await ctx.db
    .query("seguimientos")
    .withIndex("por_cliente", (q) => q.eq("clienteId", cliente._id))
    .collect();
  if (recordatorioProximoIds(segs, ahora).has(cliente._id)) return { ok: false, razon: "recordatorio_proximo" };

  // 2) Revalidación POR AUDIENCIA. Filas de dev previas al campo → se descartan.
  if (!n.audiencia) return { ok: false, razon: "sin_audiencia" };

  if (n.audiencia === "responsable") {
    if (!cliente.responsableId) return { ok: false, razon: "sin_responsable" }; // pasó al pool
    const resp = await ctx.db.get(cliente.responsableId);
    if (!resp || resp.estado !== "activo") return { ok: false, razon: "responsable_inactivo" };
    const p = prefFrio(resp);
    if (p !== "cartera" && p !== "negocio") return { ok: false, razon: "excluido_por_preferencia" };
    return { ok: true, usuarioId: resp._id }; // redirige al responsable ACTUAL
  }

  if (n.audiencia === "admin_negocio") {
    const admin = await ctx.db.get(n.usuarioId); // el admin ORIGINAL; nunca se redirige
    if (!admin || admin.estado !== "activo" || admin.rol !== "admin") return { ok: false, razon: "destinatario_no_corresponde" };
    if (prefFrio(admin) !== "negocio") return { ok: false, razon: "excluido_por_preferencia" };
    return { ok: true, usuarioId: n.usuarioId };
  }

  // admin_pool: solo si el cliente sigue SIN asignar.
  if (cliente.responsableId) return { ok: false, razon: "destinatario_no_corresponde" };
  const admin = await ctx.db.get(n.usuarioId);
  if (!admin || admin.estado !== "activo" || admin.rol !== "admin") return { ok: false, razon: "destinatario_no_corresponde" };
  if (prefFrio(admin) !== "pool") return { ok: false, razon: "excluido_por_preferencia" };
  return { ok: true, usuarioId: n.usuarioId };
}

/**
 * Reclama un lote de notificaciones listas para enviar. Antes: recupera las
 * `enviando` con lease vencido (una action que cayó a medias) devolviéndolas a
 * `pendiente`. Luego, de las pendientes elegibles (proximoIntento <= ahora):
 * descarta las obsoletas (cliente borrado o ya no Inactivo), respeta el guard de
 * horario diurno por zona del negocio, y reclama el resto moviéndolas a `enviando`
 * con lease e incrementando `intentos`. Devuelve los reclamos a enviar.
 */
export const reclamarLote = internalMutation({
  args: {},
  handler: async (ctx): Promise<Reclamo[]> => {
    const ahora = Date.now();

    // 1) Recuperación: leases vencidos vuelven a la cola.
    const enviando = await ctx.db
      .query("notificacionesPush")
      .withIndex("por_estado", (q) => q.eq("estado", "enviando"))
      .collect();
    for (const n of enviando) {
      if ((n.leaseHasta ?? 0) < ahora) await ctx.db.patch(n._id, { estado: "pendiente" });
    }

    // 2) Reclamar pendientes elegibles.
    const pendientes = await ctx.db
      .query("notificacionesPush")
      .withIndex("por_estado", (q) => q.eq("estado", "pendiente"))
      .collect();
    const elegibles = pendientes.filter((n) => (n.proximoIntento ?? n.creadoEn) <= ahora).slice(0, LOTE_MAX);

    const negocioCache = new Map<Id<"negocios">, string>();
    const reclamos: Reclamo[] = [];
    for (const n of elegibles) {
      const cliente = await ctx.db.get(n.clienteId);
      if (!cliente || cliente.eliminadoEn != null || cliente.estado !== "inactivo") {
        await ctx.db.patch(n._id, { estado: "descartada", resultado: "cliente_obsoleto", leaseHasta: undefined });
        continue;
      }
      // B-1: revalidación transaccional (recordatorio próximo + destinatario vigente).
      const rev = await revalidarDestino(ctx, n, cliente, ahora);
      if (!rev.ok) {
        await ctx.db.patch(n._id, { estado: "descartada", resultado: rev.razon, leaseHasta: undefined });
        continue;
      }
      let tz = negocioCache.get(n.negocioId);
      if (tz === undefined) {
        const negocio = await ctx.db.get(n.negocioId);
        tz = negocio?.zonaHoraria ?? "America/Mexico_City";
        negocioCache.set(n.negocioId, tz);
      }
      const hora = partesLocales(ahora, tz).hora;
      if (hora < HORA_INICIO || hora >= HORA_FIN) continue; // fuera de horario: sigue pendiente

      const intentos = (n.intentos ?? 0) + 1;
      const patch: Record<string, unknown> = { estado: "enviando", leaseHasta: ahora + LEASE_MS, intentos };
      if (rev.usuarioId !== n.usuarioId) patch.usuarioId = rev.usuarioId; // redirección tras reasignación
      await ctx.db.patch(n._id, patch);
      reclamos.push({ id: n._id, usuarioId: rev.usuarioId, clienteId: n.clienteId, nombre: cliente.nombre, intentos });
    }
    return reclamos;
  },
});

/**
 * Registra el resultado REAL de un intento de envío (obs. B-3, P-1). Terminal sin
 * reintento cuando no hay fallos transitorios: `entregada` solo si algún dispositivo
 * recibió el push (`enviadas > 0`); `suscripcion_caducada` si todos devolvieron
 * 404/410 (ya borradas, no se reintentan); `sin_dispositivos` si no había ninguno.
 * Con fallos transitorios (`fallidas > 0`): reintento con backoff hasta `MAX_INTENTOS`,
 * luego `descartada`. Idempotente frente a leases perdidos: solo actúa si la fila
 * sigue en `enviando` y en el MISMO intento reclamado.
 *
 * Entrega parcial: ante `fallidas > 0` se reintenta el conjunto completo de
 * suscripciones del usuario, por lo que un dispositivo que ya recibió el push podría
 * volver a verlo (duplicado aceptado; el `tag` los colapsa en el dispositivo).
 */
export const registrarResultado = internalMutation({
  args: {
    id: v.id("notificacionesPush"),
    intentos: v.number(),
    enviadas: v.number(),
    caducadas: v.number(),
    fallidas: v.number(),
  },
  handler: async (ctx, { id, intentos, enviadas, caducadas, fallidas }) => {
    const n = await ctx.db.get(id);
    if (!n || n.estado !== "enviando" || (n.intentos ?? 0) !== intentos) return; // lease perdido / ya resuelto
    const ahora = Date.now();
    if (fallidas > 0) {
      if (intentos >= MAX_INTENTOS) {
        await ctx.db.patch(id, { estado: "descartada", leaseHasta: undefined, resultado: "fallo_persistente" });
      } else {
        await ctx.db.patch(id, {
          estado: "pendiente",
          leaseHasta: undefined,
          proximoIntento: ahora + BACKOFF_MS * intentos,
        });
      }
      return;
    }
    // Sin fallos transitorios → terminal, sin reintento.
    let resultado: string;
    if (enviadas > 0) resultado = "entregada";
    else if (caducadas > 0) resultado = "suscripcion_caducada";
    else resultado = "sin_dispositivos"; // sin ninguna suscripción
    await ctx.db.patch(id, { estado: "enviada", enviadaEn: ahora, leaseHasta: undefined, resultado });
  },
});

// --- Helpers SOLO para pruebas (dev) ---------------------------------------
// Permiten ejercer ramas dependientes del tiempo/estado (recuperación de lease,
// backoff, idempotencia) sin poder controlar el reloj. Son internos (no los llama
// la app) y además exigen la env `QA_HELPERS=1`, que solo existe en dev → inertes
// en producción. El auditor los admitió como vía para la cobertura dinámica.

const ESTADO_V = v.union(v.literal("pendiente"), v.literal("enviando"), v.literal("enviada"), v.literal("descartada"));

/** Ajusta campos de control de una notificación (solo pruebas). */
export const qaAjustarNotif = internalMutation({
  args: {
    id: v.id("notificacionesPush"),
    estado: v.optional(ESTADO_V),
    intentos: v.optional(v.number()),
    proximoIntento: v.optional(v.number()),
    leaseHasta: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, { id, estado, intentos, proximoIntento, leaseHasta }) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    const patch: Record<string, unknown> = {};
    if (estado !== undefined) patch.estado = estado;
    if (intentos !== undefined) patch.intentos = intentos;
    if (proximoIntento !== undefined) patch.proximoIntento = proximoIntento;
    if (leaseHasta !== undefined) patch.leaseHasta = leaseHasta ?? undefined;
    await ctx.db.patch(id, patch);
  },
});

/** Lista las notificaciones (id + estado/control) para las aserciones (solo pruebas). */
export const qaListarNotifs = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    const all = (await ctx.db.query("notificacionesPush").collect()).sort((a, b) => b.creadoEn - a.creadoEn);
    return all.map((n) => ({
      id: n._id,
      clienteId: n.clienteId,
      usuarioId: n.usuarioId,
      audiencia: n.audiencia ?? null,
      estado: n.estado,
      intentos: n.intentos ?? 0,
      resultado: n.resultado ?? null,
      proximoIntentoFuturo: (n.proximoIntento ?? 0) > Date.now(),
      leaseHasta: n.leaseHasta ?? null,
    }));
  },
});

/**
 * Voltea el `estado` (activo/inactivo) de un usuario para ejercer dinámicamente los
 * ramos de "destinatario inactivo" de la revalidación (solo pruebas). No toca sesiones
 * ni credenciales (a diferencia de `usuarios.desactivar`/`reactivar`): es reversible y
 * no rompe el login demo. Sin el guard de "último admin activo" — es dev, controlado.
 */
export const qaSetEstadoUsuario = internalMutation({
  args: { usuarioId: v.id("usuarios"), estado: v.union(v.literal("activo"), v.literal("inactivo")) },
  handler: async (ctx, { usuarioId, estado }) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    await ctx.db.patch(usuarioId, { estado });
  },
});

/** Borra todas las notificaciones (limpieza de residuos QA en dev). */
export const qaPurgarNotifs = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    const all = await ctx.db.query("notificacionesPush").collect();
    for (const n of all) await ctx.db.delete(n._id);
    return { borradas: all.length };
  },
});
