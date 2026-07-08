import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { resolverSesion } from "./auth";

// Ventas / ingresos registrados (Mejora #2, JUA-110). Se leen desde
// `clientes.detalle` y aparecen en el historial del cliente. Registrar una venta
// NO cambia el estado del cliente.

/**
 * Registra una venta para un cliente (JUA-110). Importe > 0 obligatorio; fecha en
 * epoch. `registradoPor` = quien la crea. Si se vincula una oportunidad, debe ser
 * del mismo cliente/negocio. Valida pertenencia del cliente al negocio (JUA-10).
 */
export const crear = mutation({
  args: {
    token: v.string(),
    clienteId: v.id("clientes"),
    oportunidadId: v.optional(v.id("oportunidades")),
    importe: v.number(),
    fecha: v.number(),
  },
  handler: async (ctx, args) => {
    const sesion = await resolverSesion(ctx, args.token);
    if (!sesion) throw new Error("No autorizado");

    const cliente = await ctx.db.get(args.clienteId);
    if (!cliente || cliente.negocioId !== sesion.negocioId || cliente.eliminadoEn != null) {
      throw new Error("No encontrado");
    }
    if (!(args.importe > 0)) throw new Error("El importe debe ser mayor que cero");

    if (args.oportunidadId) {
      const opo = await ctx.db.get(args.oportunidadId);
      if (!opo || opo.negocioId !== sesion.negocioId || opo.clienteId !== args.clienteId) {
        throw new Error("Oportunidad no válida");
      }
    }

    return await ctx.db.insert("ventas", {
      negocioId: sesion.negocioId,
      clienteId: args.clienteId,
      oportunidadId: args.oportunidadId,
      importe: args.importe,
      fecha: args.fecha,
      registradoPorId: sesion.usuario._id,
    });
  },
});
