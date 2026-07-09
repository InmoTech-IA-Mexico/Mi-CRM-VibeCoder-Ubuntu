import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { resolverSesion } from "./auth";

// Oportunidades de venta de un cliente (JUA-20 crear · JUA-21 pipeline). Se leen
// desde `clientes.detalle`. Etapas: nueva → en_contacto → propuesta → negociacion
// → [ganada | perdida | cancelada] (cerradas). El orden no es obligatorio.

const ETAPA = v.union(
  v.literal("nueva"),
  v.literal("en_contacto"),
  v.literal("propuesta"),
  v.literal("negociacion"),
  v.literal("ganada"),
  v.literal("perdida"),
  v.literal("cancelada"),
);
const MODELO_VENTA = v.union(v.literal("unico"), v.literal("recurrente"));
// Etapas permitidas al crear (abiertas). Las cerradas se alcanzan luego desde la
// ficha (y perdida/cancelada exigen motivo), no en el alta.
const ETAPA_INICIAL = v.union(
  v.literal("nueva"),
  v.literal("en_contacto"),
  v.literal("propuesta"),
  v.literal("negociacion"),
);

// Al pasar a estas etapas se exige un motivo (se guarda en `motivoPerdida`).
const REQUIEREN_MOTIVO = ["perdida", "cancelada"];

// Valida que la oportunidad pertenezca al negocio de la sesión Y que su cliente
// padre exista y no esté en papelera (JUA-10/JUA-16). Devuelve la oportunidad.
async function oportunidadEditable(
  ctx: MutationCtx,
  oportunidadId: Id<"oportunidades">,
  negocioId: Id<"negocios">,
) {
  const opo = await ctx.db.get(oportunidadId);
  if (!opo || opo.negocioId !== negocioId) throw new Error("No encontrado");
  const cliente = await ctx.db.get(opo.clienteId);
  if (!cliente || cliente.negocioId !== negocioId || cliente.eliminadoEn != null) {
    throw new Error("No encontrado");
  }
  return opo;
}

/**
 * Crea una oportunidad asociada a un cliente (JUA-20). Etapa inicial abierta
 * (por defecto "nueva"); responsable = quien la crea. Valida pertenencia del
 * cliente al negocio y que no esté en papelera (JUA-10).
 */
export const crear = mutation({
  args: {
    token: v.string(),
    clienteId: v.id("clientes"),
    nombre: v.string(),
    etapa: v.optional(ETAPA_INICIAL),
    productoServicio: v.optional(v.string()),
    modeloVenta: v.optional(MODELO_VENTA),
    monto: v.optional(v.number()),
    fechaCierre: v.optional(v.number()),
    comentarios: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sesion = await resolverSesion(ctx, args.token);
    if (!sesion) throw new Error("No autorizado");

    const cliente = await ctx.db.get(args.clienteId);
    if (!cliente || cliente.negocioId !== sesion.negocioId || cliente.eliminadoEn != null) {
      throw new Error("No encontrado");
    }
    const nombre = args.nombre.trim();
    if (!nombre) throw new Error("El nombre de la oportunidad es obligatorio");

    const ahora = Date.now();
    return await ctx.db.insert("oportunidades", {
      negocioId: sesion.negocioId,
      clienteId: args.clienteId,
      nombre,
      productoServicio: args.productoServicio?.trim() || undefined,
      modeloVenta: args.modeloVenta,
      monto: args.monto,
      etapa: args.etapa ?? "nueva",
      fechaCierre: args.fechaCierre,
      comentarios: args.comentarios?.trim() || undefined,
      responsableId: sesion.usuario._id,
      actualizadoEn: ahora,
      actualizadoPor: sesion.usuario._id,
    });
  },
});

/**
 * Cambia la etapa de una oportunidad (JUA-21). El estado se puede cambiar en
 * cualquier momento (no hay orden obligatorio). Al pasar a Perdida/Cancelada se
 * exige `motivo`. Registra quién y cuándo (trazabilidad). Valida pertenencia.
 * Cualquier rol puede cambiar la etapa (incluido cancelar); borrar es solo admin.
 */
export const cambiarEtapa = mutation({
  args: {
    token: v.string(),
    oportunidadId: v.id("oportunidades"),
    etapa: ETAPA,
    motivo: v.optional(v.string()),
  },
  handler: async (ctx, { token, oportunidadId, etapa, motivo }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) throw new Error("No autorizado");
    await oportunidadEditable(ctx, oportunidadId, sesion.negocioId);

    const base = {
      etapa,
      actualizadoEn: Date.now(),
      actualizadoPor: sesion.usuario._id,
    };
    if (REQUIEREN_MOTIVO.includes(etapa)) {
      const m = motivo?.trim();
      if (!m) throw new Error("Indica el motivo para marcarla como perdida o cancelada");
      await ctx.db.patch(oportunidadId, { ...base, motivoPerdida: m });
    } else {
      // Al volver a una etapa abierta, se limpia el motivo (ya no aplica).
      await ctx.db.patch(oportunidadId, { ...base, motivoPerdida: undefined });
    }
  },
});

/** Elimina una oportunidad permanentemente (JUA-21). Solo admin (Marta). */
export const eliminar = mutation({
  args: { token: v.string(), oportunidadId: v.id("oportunidades") },
  handler: async (ctx, { token, oportunidadId }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion || sesion.usuario.rol !== "admin") throw new Error("No autorizado");
    await oportunidadEditable(ctx, oportunidadId, sesion.negocioId);

    await ctx.db.delete(oportunidadId);
  },
});

/**
 * Resumen del mes (JUA-34). Solo admin. Agrega las oportunidades **cerradas** del
 * negocio (ganada/perdida/cancelada) cuya fecha de cierre cae en [desde, hasta)
 * — el rango lo calcula el cliente en la zona horaria del negocio. Devuelve:
 * ganadas (nº + ingresos estimados por `monto`), perdidas/canceladas (nº +
 * motivos frecuentes), tasa de conversión y desglose por modelo de venta.
 */
export const reporteMensual = query({
  args: { token: v.string(), desde: v.number(), hasta: v.number() },
  handler: async (ctx, { token, desde, hasta }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion || sesion.usuario.rol !== "admin") return null;

    const opos = await ctx.db
      .query("oportunidades")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();

    const CERRADAS = ["ganada", "perdida", "cancelada"];
    // Fecha de cierre ≈ cuándo se marcó cerrada (`actualizadoEn`), con respaldos.
    const cerradaEn = (o: (typeof opos)[number]) => o.actualizadoEn ?? o.fechaCierre ?? o._creationTime;
    const enPeriodo = opos.filter(
      (o) => CERRADAS.includes(o.etapa) && cerradaEn(o) >= desde && cerradaEn(o) < hasta,
    );

    const ganadas = enPeriodo.filter((o) => o.etapa === "ganada");
    const perdidas = enPeriodo.filter((o) => o.etapa === "perdida" || o.etapa === "cancelada");

    const ingresosEstimados = ganadas.reduce((s, o) => s + (o.monto ?? 0), 0);
    const ganadasSinMonto = ganadas.filter((o) => o.monto == null).length;
    const totalCerradas = enPeriodo.length;
    const tasaConversion = totalCerradas > 0 ? Math.round((ganadas.length / totalCerradas) * 100) : null;

    // Desglose por modelo de venta (sobre las ganadas).
    const porModelo = (["unico", "recurrente"] as const).map((modelo) => {
      const g = ganadas.filter((o) => o.modeloVenta === modelo);
      return { modelo, count: g.length, monto: g.reduce((s, o) => s + (o.monto ?? 0), 0) };
    });
    const ganadasSinModelo = ganadas.filter((o) => !o.modeloVenta).length;

    // Motivos más frecuentes de perdida/cancelación.
    const motivoMap = new Map<string, number>();
    for (const o of perdidas) {
      const m = o.motivoPerdida?.trim();
      if (m) motivoMap.set(m, (motivoMap.get(m) ?? 0) + 1);
    }
    const motivos = [...motivoMap.entries()]
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      ganadas: { count: ganadas.length, monto: ingresosEstimados, sinMonto: ganadasSinMonto },
      perdidas: { count: perdidas.length, motivos },
      tasaConversion,
      totalCerradas,
      ingresosEstimados,
      porModelo,
      ganadasSinModelo,
    };
  },
});
