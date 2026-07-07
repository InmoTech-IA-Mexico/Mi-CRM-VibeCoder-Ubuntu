import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { resolverSesion } from "./auth";

// Recordatorios / seguimientos con un cliente (JUA-22). Aparecen en la agenda de
// Inicio (JUA-23) y en la sección "Seguimientos pendientes" de la ficha. La fecha
// llega ya calculada como epoch en la zona horaria del negocio (no UTC servidor).

const PRIORIDAD = v.union(v.literal("alta"), v.literal("media"), v.literal("baja"));

/**
 * Programa un recordatorio de seguimiento con un cliente (JUA-22). Estado inicial
 * "pendiente", frecuencia "una vez", responsable = quien lo crea. Valida
 * pertenencia del cliente (y de la oportunidad, si se vincula) al negocio (JUA-10).
 * Al guardar aparece en la agenda de Inicio el día/hora programados.
 */
export const crear = mutation({
  args: {
    token: v.string(),
    clienteId: v.id("clientes"),
    titulo: v.string(),
    fecha: v.number(),
    hora: v.optional(v.string()),
    descripcion: v.optional(v.string()),
    oportunidadId: v.optional(v.id("oportunidades")),
    prioridad: PRIORIDAD,
  },
  handler: async (ctx, args) => {
    const sesion = await resolverSesion(ctx, args.token);
    if (!sesion) throw new Error("No autorizado");

    const cliente = await ctx.db.get(args.clienteId);
    if (!cliente || cliente.negocioId !== sesion.negocioId || cliente.eliminadoEn != null) {
      throw new Error("No encontrado");
    }

    const titulo = args.titulo.trim();
    if (!titulo) throw new Error("El título es obligatorio");

    // Si se vincula una oportunidad, debe ser del mismo cliente/negocio.
    if (args.oportunidadId) {
      const opo = await ctx.db.get(args.oportunidadId);
      if (!opo || opo.negocioId !== sesion.negocioId || opo.clienteId !== args.clienteId) {
        throw new Error("Oportunidad no válida");
      }
    }

    return await ctx.db.insert("seguimientos", {
      negocioId: sesion.negocioId,
      destino: "cliente",
      clienteId: args.clienteId,
      oportunidadId: args.oportunidadId,
      titulo,
      descripcion: args.descripcion?.trim() || undefined,
      fecha: args.fecha,
      hora: args.hora || undefined,
      responsableId: sesion.usuario._id,
      prioridad: args.prioridad,
      frecuencia: "una_vez",
      estado: "pendiente",
    });
  },
});
