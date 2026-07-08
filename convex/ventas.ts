import { mutation, query } from "./_generated/server";
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

/**
 * Panel de ventas del negocio (JUA-112/113). El cliente pasa el rango del periodo
 * y del periodo anterior (calculados en la zona del negocio). Devuelve KPIs
 * (total, nº, ticket medio, variación %), desgloses por canal/responsable y las
 * ventas recientes. El canal se toma del cliente (origen). Deriva negocio de la
 * sesión (JUA-10).
 */
export const resumen = query({
  args: {
    token: v.string(),
    desde: v.number(),
    hasta: v.number(),
    desdePrev: v.number(),
    hastaPrev: v.number(),
  },
  handler: async (ctx, { token, desde, hasta, desdePrev, hastaPrev }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return null;
    // El panel de métricas del equipo es solo para admin (JUA-114). El operativo
    // registra ventas desde la ficha, pero no ve totales/ranking del equipo.
    if (sesion.usuario.rol !== "admin") return null;

    const ventas = await ctx.db
      .query("ventas")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    const clientes = await ctx.db
      .query("clientes")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    const usuarios = await ctx.db
      .query("usuarios")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    const cli = new Map(clientes.map((c) => [c._id, c]));
    const nombreUsuario = new Map(usuarios.map((u) => [u._id, u.nombre]));

    const enPeriodo = ventas.filter((v) => v.fecha >= desde && v.fecha < hasta);
    const total = enPeriodo.reduce((s, v) => s + v.importe, 0);
    const count = enPeriodo.length;
    const ticketMedio = count > 0 ? Math.round(total / count) : 0;
    const totalPrev = ventas
      .filter((v) => v.fecha >= desdePrev && v.fecha < hastaPrev)
      .reduce((s, v) => s + v.importe, 0);
    const variacion = totalPrev > 0 ? Math.round(((total - totalPrev) / totalPrev) * 100) : null;

    // Por canal (origen del cliente).
    const porCanalMap = new Map<string, number>();
    for (const v of enPeriodo) {
      const canal = cli.get(v.clienteId)?.canal ?? "sin_canal";
      porCanalMap.set(canal, (porCanalMap.get(canal) ?? 0) + v.importe);
    }
    const porCanal = [...porCanalMap.entries()]
      .map(([canal, importe]) => ({ canal, importe, pct: total > 0 ? Math.round((importe / total) * 100) : 0 }))
      .sort((a, b) => b.importe - a.importe);

    // Por responsable.
    const porRespMap = new Map<string, { nombre: string; count: number; importe: number }>();
    for (const v of enPeriodo) {
      const id = v.registradoPorId as unknown as string;
      const prev = porRespMap.get(id) ?? { nombre: nombreUsuario.get(v.registradoPorId) ?? "—", count: 0, importe: 0 };
      prev.count += 1;
      prev.importe += v.importe;
      porRespMap.set(id, prev);
    }
    const porResponsable = [...porRespMap.values()].sort((a, b) => b.importe - a.importe);

    // Ventas recientes del periodo.
    const recientes = enPeriodo
      .sort((a, b) => b.fecha - a.fecha)
      .slice(0, 8)
      .map((v) => ({
        _id: v._id,
        clienteNombre: cli.get(v.clienteId)?.nombre ?? "Cliente",
        importe: v.importe,
        canal: cli.get(v.clienteId)?.canal ?? null,
        responsableNombre: nombreUsuario.get(v.registradoPorId) ?? "—",
        fecha: v.fecha,
      }));

    return { total, count, ticketMedio, variacion, porCanal, porResponsable, recientes };
  },
});
