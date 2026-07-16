import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { resolverSesion, resolverSesionEscritura } from "./auth";
import { verificarCartera } from "./clientes";
import { partesLocales, epochDeLocal } from "./fechas";

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
    const sesion = await resolverSesionEscritura(ctx, args.token);
    if (!sesion) throw new Error("No autorizado");

    const cliente = await ctx.db.get(args.clienteId);
    if (!cliente || cliente.negocioId !== sesion.negocioId || cliente.eliminadoEn != null) {
      throw new Error("No encontrado");
    }
    verificarCartera(sesion, cliente); // operativo: solo su cartera (JUA-43)
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

// Seguimiento post-venta automático (JUA-37): al ganar una oportunidad se
// programa un recordatorio a +15 días (el umbral del PRD) en el CALENDARIO DEL
// NEGOCIO (JUA-28), para ofrecer el siguiente producto. Es un seguimiento
// normal: aparece en la agenda y se puede editar o cancelar (JUA-24).
const DIAS_POST_VENTA = 15;

/** Seguimientos post-venta PENDIENTES creados automáticamente para la oportunidad. */
async function postVentaPendientes(ctx: MutationCtx, opo: Doc<"oportunidades">) {
  const seguimientos = await ctx.db
    .query("seguimientos")
    .withIndex("por_cliente", (q) => q.eq("clienteId", opo.clienteId))
    .collect();
  return seguimientos.filter(
    (s) => s.origen === "post_venta" && s.oportunidadId === opo._id && s.estado === "pendiente",
  );
}

/** Programa el recordatorio post-venta al ganar. No duplica si ya hay uno pendiente. */
async function programarPostVenta(ctx: MutationCtx, opo: Doc<"oportunidades">, responsableId: Id<"usuarios">) {
  if ((await postVentaPendientes(ctx, opo)).length > 0) return;

  const negocio = await ctx.db.get(opo.negocioId);
  const tz = negocio?.zonaHoraria ?? "America/Mexico_City";
  // Fecha de cierre (hoy en el negocio) + 15 días; epochDeLocal normaliza el
  // desbordamiento de mes. Sin hora: recordatorio de día completo.
  const hoy = partesLocales(Date.now(), tz);
  const fecha = epochDeLocal(hoy.anio, hoy.mes, hoy.dia + DIAS_POST_VENTA, 0, 0, tz);

  await ctx.db.insert("seguimientos", {
    negocioId: opo.negocioId,
    destino: "cliente",
    clienteId: opo.clienteId,
    oportunidadId: opo._id,
    titulo: `Seguimiento post-venta: ${opo.nombre}`,
    descripcion:
      `Han pasado ${DIAS_POST_VENTA} días desde el cierre de ${opo.nombre}. ` +
      "Es el momento de contactar al cliente para ofrecerle el siguiente producto.",
    fecha,
    responsableId,
    prioridad: "media",
    frecuencia: "una_vez",
    estado: "pendiente",
    origen: "post_venta",
  });
}

/** Cancela los post-venta pendientes si la oportunidad deja de estar ganada. */
async function cancelarPostVenta(ctx: MutationCtx, opo: Doc<"oportunidades">) {
  for (const s of await postVentaPendientes(ctx, opo)) {
    await ctx.db.patch(s._id, { estado: "cancelado" });
  }
}

/**
 * Cambia la etapa de una oportunidad (JUA-21). El estado se puede cambiar en
 * cualquier momento (no hay orden obligatorio). Al pasar a Perdida/Cancelada se
 * exige `motivo`. Registra quién y cuándo (trazabilidad). Valida pertenencia.
 * Cualquier rol puede cambiar la etapa (incluido cancelar); borrar es solo admin.
 * Al pasar a Ganada programa el seguimiento post-venta (+15 días, JUA-37); al
 * salir de Ganada, cancela el que siga pendiente (coherente con la limpieza de
 * motivos entre categorías de JUA-122).
 */
export const cambiarEtapa = mutation({
  args: {
    token: v.string(),
    oportunidadId: v.id("oportunidades"),
    etapa: ETAPA,
    motivo: v.optional(v.string()),
  },
  handler: async (ctx, { token, oportunidadId, etapa, motivo }) => {
    const sesion = await resolverSesionEscritura(ctx, token);
    if (!sesion) throw new Error("No autorizado");
    const opo = await oportunidadEditable(ctx, oportunidadId, sesion.negocioId);
    const eraGanada = opo.etapa === "ganada";

    const base = {
      etapa,
      actualizadoEn: Date.now(),
      actualizadoPor: sesion.usuario._id,
    };
    if (REQUIEREN_MOTIVO.includes(etapa)) {
      // Perdida/Cancelada: el motivo es obligatorio (se guarda en motivoPerdida).
      const m = motivo?.trim();
      if (!m) throw new Error("Indica el motivo para marcarla como perdida o cancelada");
      await ctx.db.patch(oportunidadId, { ...base, motivoPerdida: m, motivoCierre: undefined });
    } else if (etapa === "ganada") {
      // Ganada (JUA-122): notas de cierre OPCIONALES ("¿qué fue clave?").
      await ctx.db.patch(oportunidadId, {
        ...base,
        motivoCierre: motivo?.trim() || undefined,
        motivoPerdida: undefined,
      });
    } else {
      // Al volver a una etapa abierta, se limpian los motivos (ya no aplican).
      await ctx.db.patch(oportunidadId, { ...base, motivoPerdida: undefined, motivoCierre: undefined });
    }

    // Post-venta (JUA-37): solo en las TRANSICIONES hacia/desde Ganada. El
    // responsable del recordatorio es quien cierra la venta.
    if (etapa === "ganada" && !eraGanada) {
      await programarPostVenta(ctx, opo, sesion.usuario._id);
    } else if (etapa !== "ganada" && eraGanada) {
      await cancelarPostVenta(ctx, opo);
    }
  },
});

/**
 * Elimina una oportunidad permanentemente (JUA-21). Solo admin (Marta). Cancela
 * su post-venta pendiente para no dejar recordatorios automáticos huérfanos.
 */
export const eliminar = mutation({
  args: { token: v.string(), oportunidadId: v.id("oportunidades") },
  handler: async (ctx, { token, oportunidadId }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion || sesion.usuario.rol !== "admin") throw new Error("No autorizado");
    const opo = await oportunidadEditable(ctx, oportunidadId, sesion.negocioId);

    await cancelarPostVenta(ctx, opo);
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
