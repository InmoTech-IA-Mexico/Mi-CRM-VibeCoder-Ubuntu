import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { resolverSesion } from "./auth";

// Etiquetas de producto (JUA-36): catálogo configurable POR NEGOCIO para
// clasificar clientes por producto comprado o de interés. Leer es de ambos
// roles (asignar y filtrar); crear/renombrar/eliminar es solo admin. Los
// rechazos de validación usan `ConvexError` para que el motivo llegue al
// cliente también en producción (lección JUA-120).

const NOMBRE_MAX = 30;

/** Resuelve la sesión y exige rol admin. */
async function sesionAdmin(ctx: QueryCtx | MutationCtx, token: string) {
  const sesion = await resolverSesion(ctx, token);
  if (!sesion || sesion.usuario.rol !== "admin") return null;
  return sesion;
}

/** Valida y normaliza el nombre; comprueba unicidad (sin distinguir mayúsculas). */
async function nombreValidado(
  ctx: MutationCtx,
  negocioId: Id<"negocios">,
  nombre: string,
  ignorarId?: Id<"etiquetas">,
) {
  const limpio = nombre.trim().replace(/\s+/g, " ");
  if (!limpio) throw new ConvexError("El nombre de la etiqueta es obligatorio");
  if (limpio.length > NOMBRE_MAX) {
    throw new ConvexError(`El nombre no puede superar ${NOMBRE_MAX} caracteres`);
  }
  const existentes = await ctx.db
    .query("etiquetas")
    .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
    .collect();
  const repetida = existentes.some(
    (e) => e._id !== ignorarId && e.nombre.toLowerCase() === limpio.toLowerCase(),
  );
  if (repetida) throw new ConvexError("Ya existe una etiqueta con ese nombre");
  return limpio;
}

/**
 * Etiquetas del negocio con su nº de clientes (ambos roles: se usan para
 * asignar desde la ficha, filtrar en la lista y gestionar en /etiquetas).
 */
export const listar = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return null;

    const etiquetas = await ctx.db
      .query("etiquetas")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();

    // Nº de clientes por etiqueta (excluye papelera) — caso de uso de Marta:
    // "cuántos clientes tengo en cada segmento de producto".
    const clientes = await ctx.db
      .query("clientes")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    const usoPorEtiqueta = new Map<string, number>();
    for (const c of clientes) {
      if (c.eliminadoEn != null) continue;
      for (const id of c.etiquetaIds ?? []) {
        usoPorEtiqueta.set(id, (usoPorEtiqueta.get(id) ?? 0) + 1);
      }
    }

    return etiquetas
      .map((e) => ({ _id: e._id, nombre: e.nombre, clientes: usoPorEtiqueta.get(e._id) ?? 0 }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },
});

/** Crea una etiqueta del negocio. Solo admin. Devuelve su id (para autoseleccionar). */
export const crear = mutation({
  args: { token: v.string(), nombre: v.string() },
  handler: async (ctx, { token, nombre }) => {
    const sesion = await sesionAdmin(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const limpio = await nombreValidado(ctx, sesion.negocioId, nombre);
    return await ctx.db.insert("etiquetas", { negocioId: sesion.negocioId, nombre: limpio });
  },
});

/** Renombra una etiqueta. Solo admin; etiqueta del propio negocio. */
export const renombrar = mutation({
  args: { token: v.string(), etiquetaId: v.id("etiquetas"), nombre: v.string() },
  handler: async (ctx, { token, etiquetaId, nombre }) => {
    const sesion = await sesionAdmin(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const etiqueta = await ctx.db.get(etiquetaId);
    if (!etiqueta || etiqueta.negocioId !== sesion.negocioId) throw new Error("No encontrado");

    const limpio = await nombreValidado(ctx, sesion.negocioId, nombre, etiquetaId);
    await ctx.db.patch(etiquetaId, { nombre: limpio });
  },
});

/**
 * Elimina una etiqueta del catálogo y la quita de todos los clientes que la
 * tengan asignada. Solo admin; etiqueta del propio negocio.
 */
export const eliminar = mutation({
  args: { token: v.string(), etiquetaId: v.id("etiquetas") },
  handler: async (ctx, { token, etiquetaId }) => {
    const sesion = await sesionAdmin(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const etiqueta = await ctx.db.get(etiquetaId);
    if (!etiqueta || etiqueta.negocioId !== sesion.negocioId) throw new Error("No encontrado");

    const clientes = await ctx.db
      .query("clientes")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    for (const c of clientes) {
      if (c.etiquetaIds?.includes(etiquetaId)) {
        await ctx.db.patch(c._id, {
          etiquetaIds: c.etiquetaIds.filter((id) => id !== etiquetaId),
        });
      }
    }
    await ctx.db.delete(etiquetaId);
  },
});
