import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { resolverSesion } from "./auth";

// Recordatorios / seguimientos con un cliente (JUA-22). Aparecen en la agenda de
// Inicio (JUA-23) y en la sección "Seguimientos pendientes" de la ficha. La fecha
// llega ya calculada como epoch en la zona horaria del negocio (no UTC servidor).

const PRIORIDAD = v.union(v.literal("alta"), v.literal("media"), v.literal("baja"));
const FRECUENCIA = v.union(v.literal("una_vez"), v.literal("semanal"), v.literal("mensual"));
const DESTINO = v.union(v.literal("cliente"), v.literal("empleado"));

/**
 * Programa un recordatorio de seguimiento con un cliente (JUA-22). Estado inicial
 * "pendiente", frecuencia "una vez", responsable = quien lo crea. Valida
 * pertenencia del cliente (y de la oportunidad, si se vincula) al negocio (JUA-10).
 * Al guardar aparece en la agenda de Inicio el día/hora programados.
 */
export const crear = mutation({
  args: {
    token: v.string(),
    // Destino: cliente (por defecto) o empleado (JUA-119).
    destino: v.optional(DESTINO),
    clienteId: v.optional(v.id("clientes")),
    empleadoId: v.optional(v.id("usuarios")),
    // Responsable asignado (JUA-119): asignar a OTRO usuario es solo admin.
    responsableId: v.optional(v.id("usuarios")),
    notificar: v.optional(v.boolean()),
    titulo: v.string(),
    fecha: v.number(),
    hora: v.optional(v.string()),
    descripcion: v.optional(v.string()),
    oportunidadId: v.optional(v.id("oportunidades")),
    prioridad: PRIORIDAD,
    frecuencia: v.optional(FRECUENCIA),
    fechaFin: v.optional(v.number()),
    diaRecurrencia: v.optional(v.number()), // día-del-mes local (lo envía el cliente)
  },
  handler: async (ctx, args) => {
    const sesion = await resolverSesion(ctx, args.token);
    if (!sesion) throw new Error("No autorizado");
    const negocioId = sesion.negocioId;
    const esAdmin = sesion.usuario.rol === "admin";

    const titulo = args.titulo.trim();
    if (!titulo) throw new Error("El título es obligatorio");

    const destino = args.destino ?? "cliente";
    let clienteId: typeof args.clienteId;
    let empleadoId: typeof args.empleadoId;
    let notificar: boolean | undefined;
    let responsableId;

    if (destino === "cliente") {
      if (!args.clienteId) throw new Error("Falta el cliente del seguimiento");
      const cliente = await ctx.db.get(args.clienteId);
      if (!cliente || cliente.negocioId !== negocioId || cliente.eliminadoEn != null) {
        throw new Error("No encontrado");
      }
      clienteId = args.clienteId;
      // Responsable: por defecto quien lo crea; el admin puede asignar a otro.
      responsableId = args.responsableId ?? sesion.usuario._id;
    } else {
      // Seguimiento a un empleado: lo atiende el propio empleado (es el responsable).
      if (!args.empleadoId) throw new Error("Falta el empleado del seguimiento");
      const emp = await ctx.db.get(args.empleadoId);
      if (!emp || emp.negocioId !== negocioId || emp.estado !== "activo") {
        throw new Error("Empleado no válido");
      }
      empleadoId = args.empleadoId;
      responsableId = args.empleadoId;
      notificar = args.notificar;
    }

    // Asignar a otro miembro del equipo (responsable ≠ creador) es solo admin (JUA-119).
    if (responsableId !== sesion.usuario._id && !esAdmin) {
      throw new Error("Solo un administrador puede asignar el seguimiento a otro miembro del equipo");
    }
    const responsable = await ctx.db.get(responsableId);
    if (!responsable || responsable.negocioId !== negocioId || responsable.estado !== "activo") {
      throw new Error("Responsable no válido");
    }

    // Recurrencia (JUA-115): la fecha de fin (opcional) no puede ser anterior al inicio.
    const frecuencia = args.frecuencia ?? "una_vez";
    const recurrente = frecuencia !== "una_vez";
    if (recurrente && args.fechaFin != null && args.fechaFin < args.fecha) {
      throw new Error("La fecha de fin no puede ser anterior a la de inicio");
    }

    // La oportunidad solo aplica a seguimientos de cliente (mismo cliente/negocio).
    if (args.oportunidadId) {
      if (destino !== "cliente") throw new Error("La oportunidad solo aplica a seguimientos de cliente");
      const opo = await ctx.db.get(args.oportunidadId);
      if (!opo || opo.negocioId !== negocioId || opo.clienteId !== clienteId) {
        throw new Error("Oportunidad no válida");
      }
    }

    return await ctx.db.insert("seguimientos", {
      negocioId,
      destino,
      clienteId,
      empleadoId,
      oportunidadId: destino === "cliente" ? args.oportunidadId : undefined,
      titulo,
      descripcion: args.descripcion?.trim() || undefined,
      fecha: args.fecha,
      hora: args.hora || undefined,
      responsableId,
      notificar: destino === "empleado" ? notificar : undefined,
      prioridad: args.prioridad,
      frecuencia,
      fechaFin: recurrente ? args.fechaFin : undefined,
      diaRecurrencia: frecuencia === "mensual" ? args.diaRecurrencia : undefined,
      estado: "pendiente",
    });
  },
});

// Gestión de recordatorios existentes (JUA-24). Solo el responsable asignado o un
// admin pueden gestionarlos. Se accede desde la ficha y la agenda del día.

/**
 * Carga un seguimiento validando negocio (JUA-10) y permiso de gestión (JUA-24):
 * el responsable asignado o un admin. Devuelve el seguimiento o lanza error.
 */
async function seguimientoGestionable(
  ctx: MutationCtx,
  token: string,
  seguimientoId: Id<"seguimientos">,
) {
  const sesion = await resolverSesion(ctx, token);
  if (!sesion) throw new Error("No autorizado");
  const seguimiento = await ctx.db.get(seguimientoId);
  if (!seguimiento || seguimiento.negocioId !== sesion.negocioId) {
    throw new Error("No encontrado");
  }
  if (seguimiento.responsableId !== sesion.usuario._id && sesion.usuario.rol !== "admin") {
    throw new Error("No autorizado");
  }
  return { sesion, seguimiento };
}

/** Reprograma un recordatorio a nueva fecha/hora; vuelve a estado "pendiente". */
export const reprogramar = mutation({
  args: {
    token: v.string(),
    seguimientoId: v.id("seguimientos"),
    fecha: v.number(),
    hora: v.optional(v.string()),
    diaRecurrencia: v.optional(v.number()), // día-del-mes local (lo envía el cliente)
  },
  handler: async (ctx, { token, seguimientoId, fecha, hora, diaRecurrencia }) => {
    const { seguimiento } = await seguimientoGestionable(ctx, token, seguimientoId);
    // Si es mensual, la nueva fecha (local) redefine el ancla del día-del-mes.
    await ctx.db.patch(seguimientoId, {
      fecha,
      hora: hora || undefined,
      estado: "pendiente",
      diaRecurrencia: seguimiento.frecuencia === "mensual" ? diaRecurrencia : undefined,
    });
  },
});

/** Cancela un recordatorio (estado "cancelado"). Desaparece de la agenda. */
export const cancelar = mutation({
  args: { token: v.string(), seguimientoId: v.id("seguimientos") },
  handler: async (ctx, { token, seguimientoId }) => {
    await seguimientoGestionable(ctx, token, seguimientoId);
    await ctx.db.patch(seguimientoId, { estado: "cancelado" });
  },
});

/** Elimina un recordatorio permanentemente (con confirmación en la UI). */
export const eliminar = mutation({
  args: { token: v.string(), seguimientoId: v.id("seguimientos") },
  handler: async (ctx, { token, seguimientoId }) => {
    await seguimientoGestionable(ctx, token, seguimientoId);
    await ctx.db.delete(seguimientoId);
  },
});
