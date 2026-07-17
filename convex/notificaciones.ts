import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { partesLocales } from "./fechas";

// Cola de notificaciones push (JUA-33 Fase C). Estas funciones (runtime normal)
// deciden QUÉ enviar y marcan el resultado; el envío real lo hace la action Node
// `pushEnvio.flushNotificaciones`, que las orquesta.

// Horario diurno del negocio para no enviar de noche (decisión de producto).
const HORA_INICIO = 9;
const HORA_FIN = 20; // [9:00, 20:00)

type Item =
  | { accion: "descartar"; id: Id<"notificacionesPush"> }
  | {
      accion: "enviar";
      id: Id<"notificacionesPush">;
      usuarioId: Id<"usuarios">;
      clienteId: Id<"clientes">;
      nombre: string;
    };

/**
 * Notificaciones pendientes con su decisión: `descartar` (cliente borrado o ya no
 * inactivo → alerta obsoleta) o `enviar` (cliente sigue frío Y es horario diurno en
 * la zona del negocio). Las que están fuera de horario se omiten (siguen pendientes).
 */
export const paraEnviar = internalQuery({
  args: {},
  handler: async (ctx): Promise<Item[]> => {
    const pendientes = await ctx.db
      .query("notificacionesPush")
      .withIndex("por_estado", (q) => q.eq("estado", "pendiente"))
      .collect();
    const ahora = Date.now();
    const negocioCache = new Map<Id<"negocios">, string>();
    const out: Item[] = [];
    for (const n of pendientes) {
      const cliente = await ctx.db.get(n.clienteId);
      // Revalidación: si el cliente se borró o dejó de estar Inactivo (lo
      // contactaron entre encolar y enviar), la alerta es obsoleta → descartar.
      if (!cliente || cliente.eliminadoEn != null || cliente.estado !== "inactivo") {
        out.push({ accion: "descartar", id: n._id });
        continue;
      }
      let tz = negocioCache.get(n.negocioId);
      if (tz === undefined) {
        const negocio = await ctx.db.get(n.negocioId);
        tz = negocio?.zonaHoraria ?? "America/Mexico_City";
        negocioCache.set(n.negocioId, tz);
      }
      const hora = partesLocales(ahora, tz).hora;
      if (hora < HORA_INICIO || hora >= HORA_FIN) continue; // fuera de horario: espera
      out.push({ accion: "enviar", id: n._id, usuarioId: n.usuarioId, clienteId: n.clienteId, nombre: cliente.nombre });
    }
    return out;
  },
});

/** Marca una notificación como enviada (procesada). Interno. */
export const marcarEnviada = internalMutation({
  args: { id: v.id("notificacionesPush") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { estado: "enviada", enviadaEn: Date.now() });
  },
});

/** Marca una notificación como descartada (obsoleta). Interno. */
export const marcarDescartada = internalMutation({
  args: { id: v.id("notificacionesPush") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { estado: "descartada" });
  },
});
