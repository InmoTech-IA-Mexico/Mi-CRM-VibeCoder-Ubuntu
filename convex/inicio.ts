import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { resolverSesion } from "./auth";

// Regla de negocio (PRD): un cliente "requiere atención" a partir de 15 días
// sin interacción real. Espejo de DIAS_INACTIVIDAD en src/lib/enums.ts.
const DIAS_INACTIVIDAD = 15;
// Un recordatorio pendiente dentro de esta ventana significa que ya hay
// seguimiento planificado → el cliente no cuenta como inactivo (JUA-25).
const PROXIMOS_DIAS_RECORDATORIO = 3;
const MS_DIA = 24 * 60 * 60 * 1000;

/**
 * Agenda del día (JUA-23): recordatorios a los que hay que atender hoy.
 *
 * Devuelve los seguimientos del negocio dirigidos a un cliente, pendientes,
 * cuya fecha cae hoy o está vencida. El `negocioId` sale de la sesión (JUA-10);
 * el cliente solo pasa el rango del día ya calculado en la zona horaria del
 * negocio (ventana de visualización de sus propios datos, no de seguridad).
 */
export const agendaDelDia = query({
  args: {
    token: v.string(),
    inicioDia: v.number(),
    finDia: v.number(),
  },
  handler: async (ctx, { token, inicioDia, finDia }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return [];
    const negocioId = sesion.negocioId;

    const seguimientos = await ctx.db
      .query("seguimientos")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();

    const relevantes = seguimientos.filter((s) => {
      const esDeHoy = s.fecha >= inicioDia && s.fecha < finDia;
      const estaVencido = s.fecha < inicioDia;
      return (
        s.estado === "pendiente" &&
        s.destino === "cliente" &&
        s.clienteId != null &&
        (esDeHoy || estaVencido)
      );
    });

    const items = await Promise.all(
      relevantes.map(async (s) => {
        const cliente = s.clienteId ? await ctx.db.get(s.clienteId) : null;
        return {
          _id: s._id,
          titulo: s.titulo,
          hora: s.hora ?? null,
          prioridad: s.prioridad,
          clienteId: s.clienteId ?? null,
          clienteNombre: cliente?.nombre ?? "Cliente",
          vencido: s.fecha < inicioDia,
        };
      }),
    );

    // Vencidos primero; luego por hora ascendente (los sin hora, al final).
    // TODO(JUA-48): cuando exista el scoring, desempatar por prioridad.
    // TODO(JUA-115): expandir recurrencias antes de aplicar el filtro del día.
    return items.sort((a, b) => {
      if (a.vencido !== b.vencido) return a.vencido ? -1 : 1;
      if (a.hora && b.hora) return a.hora.localeCompare(b.hora);
      if (a.hora) return -1;
      if (b.hora) return 1;
      return 0;
    });
  },
});

/**
 * Panel de inactividad (JUA-25): clientes que "requieren atención".
 *
 * Aparece un cliente si: estado ∈ {prospecto, activo, inactivo} (nunca `nuevo`
 * ni `descartado`), no eliminado, sin interacción real en +15 días (o registrado
 * hace +15 días sin interacción) y SIN recordatorio pendiente en los próximos 3
 * días. El `negocioId` sale de la sesión (JUA-10) y `ahora` del tiempo del
 * servidor (granularidad de día; no requiere zona horaria).
 */
export const panelInactividad = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return [];
    const negocioId = sesion.negocioId;
    const ahora = Date.now();

    // Clientes con un recordatorio pendiente en los próximos 3 días: ya tienen
    // seguimiento planificado, así que quedan fuera del panel.
    const limiteProximos = ahora + PROXIMOS_DIAS_RECORDATORIO * MS_DIA;
    const seguimientos = await ctx.db
      .query("seguimientos")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();
    const conRecordatorioProximo = new Set<Id<"clientes">>();
    for (const s of seguimientos) {
      if (
        s.estado === "pendiente" &&
        s.destino === "cliente" &&
        s.clienteId != null &&
        s.fecha >= ahora &&
        s.fecha <= limiteProximos
      ) {
        conRecordatorioProximo.add(s.clienteId);
      }
    }

    const clientes = await ctx.db
      .query("clientes")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();

    return clientes
      .filter(
        (c) =>
          c.eliminadoEn == null &&
          // Estados que sí cuentan como inactivos (JUA-25): prospecto/activo/inactivo.
          c.estado !== "nuevo" &&
          c.estado !== "descartado" &&
          !conRecordatorioProximo.has(c._id),
      )
      .map((c) => {
        const referencia = c.ultimaInteraccion ?? c._creationTime;
        return {
          _id: c._id,
          nombre: c.nombre,
          prioridad: c.prioridad ?? null,
          estado: c.estado,
          diasSinContacto: Math.floor((ahora - referencia) / MS_DIA),
        };
      })
      .filter((c) => c.diasSinContacto >= DIAS_INACTIVIDAD)
      // TODO(JUA-49): desempatar por prioridad del cliente.
      // TODO(JUA-26): la transición automática a estado "inactivo" es aparte.
      .sort((a, b) => b.diasSinContacto - a.diasSinContacto);
  },
});

/**
 * Marca un recordatorio como realizado desde la lista, sin abrir la ficha
 * (JUA-23 / JUA-24). Al mutar, `agendaDelDia` se recalcula y la card desaparece.
 *
 * Valida que el seguimiento pertenezca al negocio de la sesión (JUA-10): un
 * recurso de otro negocio devuelve el mismo error genérico que uno inexistente,
 * sin revelar si existe.
 */
export const marcarSeguimientoRealizado = mutation({
  args: { token: v.string(), seguimientoId: v.id("seguimientos") },
  handler: async (ctx, { token, seguimientoId }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const seguimiento = await ctx.db.get(seguimientoId);
    if (!seguimiento || seguimiento.negocioId !== sesion.negocioId) {
      throw new Error("No encontrado");
    }

    await ctx.db.patch(seguimientoId, { estado: "realizado" });
  },
});

/**
 * Estado global de clientes (JUA-35). Dashboard agregado del negocio, para ambos
 * roles. Totales por estado (con %), oportunidades abiertas por etapa,
 * seguimientos pendientes/vencidos y clientes "sin atender" (mismo criterio que
 * `panelInactividad`). Negocio derivado de la sesión (JUA-10); reactivo.
 */
export const estadoGlobal = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return null;
    const negocioId = sesion.negocioId;
    const ahora = Date.now();

    const clientes = (
      await ctx.db.query("clientes").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect()
    ).filter((c) => c.eliminadoEn == null);
    const total = clientes.length;
    const ESTADOS = ["nuevo", "prospecto", "activo", "inactivo", "descartado"] as const;
    const porEstado = ESTADOS.map((estado) => {
      const count = clientes.filter((c) => c.estado === estado).length;
      return { estado, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
    });

    // Oportunidades abiertas (no cerradas) por etapa del pipeline.
    const opos = await ctx.db
      .query("oportunidades")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();
    const CERRADAS = ["ganada", "perdida", "cancelada"];
    const abiertas = opos.filter((o) => !CERRADAS.includes(o.etapa));
    const ETAPAS_ABIERTAS = ["nueva", "en_contacto", "propuesta", "negociacion"] as const;
    const oportunidades = {
      total: abiertas.length,
      porEtapa: ETAPAS_ABIERTAS.map((etapa) => ({ etapa, count: abiertas.filter((o) => o.etapa === etapa).length })),
    };

    // Seguimientos pendientes + cuántos están vencidos.
    const seguimientos = await ctx.db
      .query("seguimientos")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();
    const pendientes = seguimientos.filter((s) => s.estado === "pendiente");
    const vencidos = pendientes.filter((s) => s.fecha < ahora).length;

    // Clientes sin atender: ≥15 días sin contacto, sin recordatorio próximo
    // planificado y en estado que cuenta (idéntico a panelInactividad, JUA-25).
    const limiteProximos = ahora + PROXIMOS_DIAS_RECORDATORIO * MS_DIA;
    const conRecordatorioProximo = new Set<Id<"clientes">>();
    for (const s of seguimientos) {
      if (
        s.estado === "pendiente" &&
        s.destino === "cliente" &&
        s.clienteId != null &&
        s.fecha >= ahora &&
        s.fecha <= limiteProximos
      ) {
        conRecordatorioProximo.add(s.clienteId);
      }
    }
    const sinAtender = clientes.filter(
      (c) =>
        c.estado !== "nuevo" &&
        c.estado !== "descartado" &&
        !conRecordatorioProximo.has(c._id) &&
        Math.floor((ahora - (c.ultimaInteraccion ?? c._creationTime)) / MS_DIA) >= DIAS_INACTIVIDAD,
    ).length;

    return {
      total,
      porEstado,
      oportunidades,
      seguimientos: { pendientes: pendientes.length, vencidos },
      sinAtender,
    };
  },
});
