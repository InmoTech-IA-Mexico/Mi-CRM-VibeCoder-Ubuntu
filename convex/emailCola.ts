import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";

// Parte DURABLE de la cola de correo transaccional (JUA-129, remediación de diseño).
// El envío real lo hace la action Node `emailEnvio.flush`, que reclama un lote aquí,
// envía por Resend y registra el resultado. Estas mutaciones dan durabilidad,
// idempotencia y reintentos con backoff a la entrega — imprescindible para la
// recuperación de contraseña, que es pública y NO tiene fallback "copiar enlace"
// (obs. B-1). El token NUNCA se guarda ni se agenda (obs. B-2): la fila solo referencia
// el recurso de dominio; el token se deriva y revalida al reclamar.

const LEASE_MS = 5 * 60 * 1000; // vigencia de una reclamación "enviando"
const MAX_INTENTOS = 3;
const LOTE_MAX = 50;
const BACKOFF_MS = 2 * 60 * 1000; // reintento: intentos * 2 min (correo es sensible al tiempo)
const CONFIG_BACKOFF_MS = 15 * 60 * 1000; // espera ante error de config del sistema (401/403)
const RETENCION_MS = 7 * 24 * 60 * 60 * 1000; // eventos terminales se purgan a los 7 días
const PURGA_LOTE = 200;

/** Referencia de dominio para encolar un correo (nunca el token). */
export type RefEmail =
  | { tipo: "invitacion"; invitacionId: Id<"invitaciones"> }
  | { tipo: "recuperacion" | "reactivacion"; recuperacionId: Id<"recuperaciones"> };

/** Ítem reclamado para enviar. El token viaja SOLO en este retorno en memoria (no en el scheduler). */
export type EmailReclamo = {
  id: Id<"emailsSalientes">;
  tipo: "invitacion" | "recuperacion" | "reactivacion";
  para: string;
  token: string;
  idempotencyKey: string;
  intentos: number;
  nombre?: string | null; // solo invitacion
  negocioNombre?: string | null; // solo invitacion
  rol?: string; // solo invitacion
};

/**
 * Encola un correo y programa el flush inmediato. Lo llaman las mutaciones de dominio
 * que crean/renuevan un token (invitar/reenviar/reactivar/solicitar/alta de negocio).
 * SUPERSEDE los eventos previos NO terminales de la misma referencia (un reenvío genera
 * un token nuevo → el evento viejo se descarta y se crea uno nuevo con su propia clave
 * idempotente, obs. B-3). No lanza: un fallo de correo no debe abortar la mutación.
 */
export async function encolar(ctx: MutationCtx, ref: RefEmail): Promise<void> {
  const ahora = Date.now();

  // Supersede eventos previos vivos de la MISMA referencia (reenvío → token nuevo).
  const previos =
    ref.tipo === "invitacion"
      ? await ctx.db.query("emailsSalientes").withIndex("por_invitacion", (q) => q.eq("invitacionId", ref.invitacionId)).collect()
      : await ctx.db.query("emailsSalientes").withIndex("por_recuperacion", (q) => q.eq("recuperacionId", ref.recuperacionId)).collect();
  for (const p of previos) {
    if (p.estado === "pendiente" || p.estado === "enviando") {
      await ctx.db.patch(p._id, { estado: "descartado", resultado: "reemplazado", leaseHasta: undefined });
    }
  }

  await ctx.db.insert("emailsSalientes", {
    tipo: ref.tipo,
    invitacionId: ref.tipo === "invitacion" ? ref.invitacionId : undefined,
    recuperacionId: ref.tipo === "invitacion" ? undefined : ref.recuperacionId,
    idempotencyKey: bytesToHex(randomBytes(16)), // no secreta, estable por evento
    estado: "pendiente",
    intentos: 0,
    proximoIntento: ahora,
    creadoEn: ahora,
  });

  // Flush inmediato (latencia baja); el cron es la red de seguridad de durabilidad. Se
  // agenda solo el disparo, SIN datos (obs. B-2). Si el envío está deshabilitado (sin
  // key), el flush es inerte y la fila espera en la cola.
  await ctx.scheduler.runAfter(0, internal.emailEnvio.flush, {});
}

/**
 * Revalida el recurso de dominio EN EL MOMENTO del envío (obs. B-2) y deriva el
 * destinatario y el token vigentes. Descarta eventos obsoletos (invitación ya no
 * pendiente/vencida, recuperación usada/expirada/eliminada, usuario inactivo).
 */
async function revalidar(
  ctx: MutationCtx,
  e: Doc<"emailsSalientes">,
  ahora: number,
  negocioCache: Map<Id<"negocios">, string | null>,
): Promise<{ ok: true; para: string; token: string; nombre?: string | null; negocioNombre?: string | null; rol?: string } | { ok: false; razon: string }> {
  if (e.tipo === "invitacion") {
    if (!e.invitacionId) return { ok: false, razon: "sin_referencia" };
    const inv = await ctx.db.get(e.invitacionId);
    if (!inv || inv.estado !== "pendiente" || inv.expiraEn <= ahora) return { ok: false, razon: "invitacion_no_vigente" };
    let negocioNombre = negocioCache.get(inv.negocioId);
    if (negocioNombre === undefined) {
      const negocio = await ctx.db.get(inv.negocioId);
      negocioNombre = negocio?.nombre ?? null;
      negocioCache.set(inv.negocioId, negocioNombre);
    }
    return { ok: true, para: inv.email, token: inv.token, nombre: inv.nombre ?? null, negocioNombre, rol: inv.rol };
  }

  // recuperacion / reactivacion
  if (!e.recuperacionId) return { ok: false, razon: "sin_referencia" };
  const rec = await ctx.db.get(e.recuperacionId);
  if (!rec || rec.usadoEn != null || rec.expiraEn <= ahora) return { ok: false, razon: "recuperacion_no_vigente" };
  const usuario = await ctx.db.get(rec.usuarioId);
  if (!usuario || usuario.estado !== "activo") return { ok: false, razon: "usuario_inactivo" };
  return { ok: true, para: usuario.email, token: rec.token };
}

/**
 * Reclama un lote listo para enviar. Recupera leases vencidos (una action que cayó a
 * medias vuelve a `pendiente`), toma pendientes elegibles por rango indexado
 * (proximoIntento<=ahora), descarta obsoletas y reclama el resto (→ `enviando` con
 * lease e intentos+1). Devuelve los reclamos con el token derivado (solo en memoria).
 */
export const reclamarLote = internalMutation({
  args: {},
  handler: async (ctx): Promise<EmailReclamo[]> => {
    const ahora = Date.now();

    // 1) Recuperación de leases vencidos (acotado a un lote, obs. escala del dictamen v2).
    const enviando = await ctx.db
      .query("emailsSalientes")
      .withIndex("por_estado_intento", (q) => q.eq("estado", "enviando"))
      .take(LOTE_MAX);
    for (const e of enviando) {
      if ((e.leaseHasta ?? 0) < ahora) await ctx.db.patch(e._id, { estado: "pendiente" });
    }

    // 2) Reclamar pendientes elegibles por RANGO (estado=pendiente ∧ proximoIntento<=ahora).
    const elegibles = await ctx.db
      .query("emailsSalientes")
      .withIndex("por_estado_intento", (q) => q.eq("estado", "pendiente").lte("proximoIntento", ahora))
      .take(LOTE_MAX);

    const negocioCache = new Map<Id<"negocios">, string | null>();
    const reclamos: EmailReclamo[] = [];
    for (const e of elegibles) {
      const datos = await revalidar(ctx, e, ahora, negocioCache);
      if (!datos.ok) {
        await ctx.db.patch(e._id, { estado: "descartado", resultado: datos.razon, leaseHasta: undefined });
        continue;
      }
      const intentos = e.intentos + 1;
      await ctx.db.patch(e._id, { estado: "enviando", leaseHasta: ahora + LEASE_MS, intentos });
      reclamos.push({
        id: e._id,
        tipo: e.tipo,
        para: datos.para,
        token: datos.token,
        idempotencyKey: e.idempotencyKey,
        intentos,
        nombre: datos.nombre,
        negocioNombre: datos.negocioNombre,
        rol: datos.rol,
      });
    }
    return reclamos;
  },
});

/**
 * Registra el resultado REAL de un intento de envío según su clase (obs. B-3). Idempotente
 * frente a leases perdidos: solo actúa si la fila sigue en `enviando` y en el MISMO intento.
 *  - `ok` → `enviado`.
 *  - `config` (401/403 del sistema) → **vuelve a `pendiente`** con espera de config; NUNCA
 *    se descarta: al corregir el entorno se reanuda sin emitir un token nuevo. Un evento
 *    bloqueado se descarta solo cuando su recurso caduca (revalidación al reclamar).
 *  - `terminal` (otros 4xx, error real de la petición) → `descartado`.
 *  - `transitorio` (red/429/5xx) → backoff hasta `MAX_INTENTOS`, luego `descartado`.
 */
export const registrarResultado = internalMutation({
  args: {
    id: v.id("emailsSalientes"),
    intentos: v.number(),
    clase: v.union(v.literal("ok"), v.literal("config"), v.literal("transitorio"), v.literal("terminal")),
    status: v.optional(v.number()),
  },
  handler: async (ctx, { id, intentos, clase, status }) => {
    const e = await ctx.db.get(id);
    if (!e || e.estado !== "enviando" || e.intentos !== intentos) return; // lease perdido / ya resuelto
    const ahora = Date.now();
    if (clase === "ok") {
      await ctx.db.patch(id, { estado: "enviado", leaseHasta: undefined, resultado: status ? `ok_${status}` : "ok" });
      return;
    }
    if (clase === "config") {
      // Error de configuración/autorización del SISTEMA: no es culpa del destinatario, así
      // que no se descarta. Espera y se reanuda al corregir el entorno (una recuperación,
      // sin fallback, no se pierde). El recurso caduca por su cuenta si nunca se arregla.
      await ctx.db.patch(id, { estado: "pendiente", leaseHasta: undefined, proximoIntento: ahora + CONFIG_BACKOFF_MS, resultado: "bloqueado_config" });
      return;
    }
    if (clase === "terminal") {
      await ctx.db.patch(id, { estado: "descartado", leaseHasta: undefined, resultado: status ? `error_${status}` : "error" });
      return;
    }
    // transitorio
    if (intentos >= MAX_INTENTOS) {
      await ctx.db.patch(id, { estado: "descartado", leaseHasta: undefined, resultado: "fallo_persistente" });
      return;
    }
    await ctx.db.patch(id, { estado: "pendiente", leaseHasta: undefined, proximoIntento: ahora + BACKOFF_MS * intentos });
  },
});

/**
 * Purga los eventos TERMINALES (`enviado`/`descartado`) con más de 7 días (la outbox no
 * debe crecer indefinidamente). Rango indexado por `(estado, creadoEn)` → reclama los más
 * antiguos primero, sin depender de correlaciones (obs. OBS-1 del dictamen v3). Acotado por
 * lote; un cron diario lo repite.
 */
export const purgarAntiguos = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ borrados: number }> => {
    const corte = Date.now() - RETENCION_MS;
    let borrados = 0;
    for (const estado of ["enviado", "descartado"] as const) {
      const lote = await ctx.db
        .query("emailsSalientes")
        .withIndex("por_estado_creado", (q) => q.eq("estado", estado).lt("creadoEn", corte))
        .take(PURGA_LOTE);
      for (const e of lote) {
        await ctx.db.delete(e._id);
        borrados++;
      }
    }
    return { borrados };
  },
});

// --- Helpers SOLO para pruebas (dev) ---------------------------------------
// Ejercen ramas dependientes del tiempo/estado (recuperación de lease, backoff,
// supersesión, revalidación) sin controlar el reloj. Internos y gateados por
// `QA_HELPERS=1` (solo dev → inertes en producción).

const ESTADO_V = v.union(v.literal("pendiente"), v.literal("enviando"), v.literal("enviado"), v.literal("descartado"));

/** Lista los eventos de correo (id + control) para las aserciones (solo pruebas). NO expone tokens. */
export const qaListarEmails = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    const all = (await ctx.db.query("emailsSalientes").collect()).sort((a, b) => b.creadoEn - a.creadoEn);
    return all.map((e) => ({
      id: e._id,
      tipo: e.tipo,
      estado: e.estado,
      intentos: e.intentos,
      resultado: e.resultado ?? null,
      invitacionId: e.invitacionId ?? null,
      recuperacionId: e.recuperacionId ?? null,
      proximoIntentoFuturo: e.proximoIntento > Date.now(),
      leaseHasta: e.leaseHasta ?? null,
      // Aserción de higiene (obs. B-2): la clave idempotente es hex no secreto; el token NO está.
      tieneIdempotencyKey: e.idempotencyKey.length > 0,
    }));
  },
});

/** Ajusta campos de control de un evento de correo (solo pruebas). */
export const qaAjustarEmail = internalMutation({
  args: {
    id: v.id("emailsSalientes"),
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

/** Encola un correo contra una referencia dada (para ejercer supersesión/reactivación en pruebas). */
export const qaEncolar = internalMutation({
  args: {
    tipo: v.union(v.literal("invitacion"), v.literal("recuperacion"), v.literal("reactivacion")),
    invitacionId: v.optional(v.id("invitaciones")),
    recuperacionId: v.optional(v.id("recuperaciones")),
  },
  handler: async (ctx, { tipo, invitacionId, recuperacionId }) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    if (tipo === "invitacion") {
      if (!invitacionId) throw new Error("falta invitacionId");
      await encolar(ctx, { tipo, invitacionId });
    } else {
      if (!recuperacionId) throw new Error("falta recuperacionId");
      await encolar(ctx, { tipo, recuperacionId });
    }
  },
});

/** Borra todos los eventos de correo (limpieza de residuos QA en dev). */
export const qaPurgarEmails = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    const all = await ctx.db.query("emailsSalientes").collect();
    for (const e of all) await ctx.db.delete(e._id);
    return { borrados: all.length };
  },
});
