import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

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
 * cuya fecha cae hoy o está vencida. El cliente pasa el rango del día ya
 * calculado en la zona horaria del negocio (queda determinista y reactiva).
 */
export const agendaDelDia = query({
  args: {
    negocioId: v.id("negocios"),
    inicioDia: v.number(),
    finDia: v.number(),
  },
  handler: async (ctx, { negocioId, inicioDia, finDia }) => {
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
 * días. `ahora` lo pasa el cliente (zona horaria del negocio) para que la query
 * sea determinista.
 */
export const panelInactividad = query({
  args: {
    negocioId: v.id("negocios"),
    ahora: v.number(),
  },
  handler: async (ctx, { negocioId, ahora }) => {
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
 */
export const marcarSeguimientoRealizado = mutation({
  args: { seguimientoId: v.id("seguimientos") },
  handler: async (ctx, { seguimientoId }) => {
    await ctx.db.patch(seguimientoId, { estado: "realizado" });
  },
});
