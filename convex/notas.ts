import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { resolverSesion } from "./auth";

// Notas / interacciones de un cliente (JUA-17). El historial se lee desde
// `clientes.detalle`. La fecha/hora se guarda automáticamente.

const TIPO_INTERACCION = v.union(
  v.literal("llamada"),
  v.literal("reunion"),
  v.literal("correo"),
  v.literal("mensaje"),
  v.literal("visita"),
  v.literal("interno"),
);

// JUA-19: solo estos tipos cuentan como contacto real con el cliente y por tanto
// actualizan `ultimaInteraccion`. El comentario "interno" NO — es administrativo
// y no debe resetear el contador de inactividad (15 días).
const TIPOS_CONTACTO_REAL = ["llamada", "reunion", "correo", "mensaje", "visita"];

/**
 * Registra una nota/interacción (JUA-17). Valida pertenencia del cliente al
 * negocio de la sesión (JUA-10). Actualiza `ultimaInteraccion` solo si el tipo
 * es contacto real (JUA-19). Devuelve el id de la nota creada.
 */
export const crear = mutation({
  args: {
    token: v.string(),
    clienteId: v.id("clientes"),
    tipo: TIPO_INTERACCION,
    descripcion: v.string(),
    resultado: v.optional(v.string()),
  },
  handler: async (ctx, { token, clienteId, tipo, descripcion, resultado }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const cliente = await ctx.db.get(clienteId);
    if (!cliente || cliente.negocioId !== sesion.negocioId || cliente.eliminadoEn != null) {
      throw new Error("No encontrado");
    }

    const texto = descripcion.trim();
    if (!texto) throw new Error("La nota no puede estar vacía");

    const ahora = Date.now();
    const notaId = await ctx.db.insert("notas", {
      negocioId: sesion.negocioId,
      clienteId,
      tipo,
      descripcion: texto,
      resultado: resultado?.trim() || undefined,
      autorId: sesion.usuario._id,
      fecha: ahora,
    });

    // JUA-19: contacto real → actualiza la última interacción del cliente.
    if (TIPOS_CONTACTO_REAL.includes(tipo)) {
      await ctx.db.patch(clienteId, { ultimaInteraccion: ahora });
    }

    return notaId;
  },
});

/**
 * Elimina una nota del historial (JUA-18). **Solo admin** (Marta); borrado
 * permanente (las notas no van a papelera). Valida pertenencia al negocio.
 */
export const eliminar = mutation({
  args: { token: v.string(), notaId: v.id("notas") },
  handler: async (ctx, { token, notaId }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion || sesion.usuario.rol !== "admin") throw new Error("No autorizado");

    const nota = await ctx.db.get(notaId);
    if (!nota || nota.negocioId !== sesion.negocioId) throw new Error("No encontrado");

    await ctx.db.delete(notaId);
  },
});
