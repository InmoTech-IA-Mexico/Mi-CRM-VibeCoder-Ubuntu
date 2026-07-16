import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { resolverSesion, resolverSesionEscritura } from "./auth";

// Recordatorios / seguimientos con un cliente (JUA-22). Aparecen en la agenda de
// Inicio (JUA-23) y en la sección "Seguimientos pendientes" de la ficha. La fecha
// llega ya calculada como epoch en la zona horaria del negocio (no UTC servidor).

const PRIORIDAD = v.union(v.literal("alta"), v.literal("media"), v.literal("baja"));
const FRECUENCIA = v.union(v.literal("una_vez"), v.literal("semanal"), v.literal("mensual"));
const DESTINO = v.union(v.literal("cliente"), v.literal("empleado"));

/** Ancla mensual: día-del-mes válido de calendario (1–31). */
const esDiaDelMesValido = (d: number) => Number.isInteger(d) && d >= 1 && d <= 31;

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
    const sesion = await resolverSesionEscritura(ctx, args.token);
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
    // El ancla mensual (día-del-mes) debe ser un día válido de calendario (1–31).
    if (frecuencia === "mensual" && args.diaRecurrencia != null && !esDiaDelMesValido(args.diaRecurrencia)) {
      throw new Error("Día de recurrencia no válido");
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

/**
 * Panel de supervisión del administrador (JUA-118). Solo admin. Lista los
 * seguimientos **pendientes delegados** —cuyo responsable NO es el propio admin—
 * agrupados por responsable (empleado): tanto tareas dirigidas a un empleado como
 * seguimientos de cliente reasignados. Permite a Marta ver qué tiene en marcha
 * cada miembro del equipo. Negocio derivado de la sesión (JUA-10); reactivo.
 */
export const panelSupervision = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion || sesion.usuario.rol !== "admin") return null;
    const negocioId = sesion.negocioId;
    const yo = sesion.usuario._id;
    const ahora = Date.now();

    const seguimientos = await ctx.db
      .query("seguimientos")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();
    const delegados = seguimientos.filter((s) => s.estado === "pendiente" && s.responsableId !== yo);

    const cacheUsuario = new Map<Id<"usuarios">, Awaited<ReturnType<typeof ctx.db.get<"usuarios">>>>();
    const getUsuario = async (id: Id<"usuarios">) => {
      if (!cacheUsuario.has(id)) cacheUsuario.set(id, await ctx.db.get(id));
      return cacheUsuario.get(id)!;
    };

    type Item = {
      _id: Id<"seguimientos">;
      titulo: string;
      fecha: number;
      hora: string | null;
      prioridad: "alta" | "media" | "baja";
      destino: "cliente" | "empleado";
      subtitulo: string;
      clienteId: Id<"clientes"> | null;
      vencido: boolean;
      notificar: boolean;
    };
    const grupos = new Map<Id<"usuarios">, { usuarioId: Id<"usuarios">; nombre: string; rol: string; items: Item[] }>();

    for (const s of delegados) {
      // Sujeto del seguimiento (excluye clientes en papelera).
      let subtitulo: string;
      let clienteId: Id<"clientes"> | null = null;
      if (s.destino === "empleado") {
        subtitulo = "Tarea personal";
      } else {
        const cliente = s.clienteId ? await ctx.db.get(s.clienteId) : null;
        // Defensa JUA-10: además de excluir papelera, revalida el negocio del cliente.
        if (!cliente || cliente.negocioId !== negocioId || cliente.eliminadoEn != null) continue;
        subtitulo = cliente.nombre;
        clienteId = s.clienteId ?? null;
      }
      const resp = await getUsuario(s.responsableId);
      if (!resp || resp.negocioId !== negocioId) continue;

      if (!grupos.has(s.responsableId)) {
        grupos.set(s.responsableId, { usuarioId: s.responsableId, nombre: resp.nombre, rol: resp.rol, items: [] });
      }
      grupos.get(s.responsableId)!.items.push({
        _id: s._id,
        titulo: s.titulo,
        fecha: s.fecha,
        hora: s.hora ?? null,
        prioridad: s.prioridad,
        destino: s.destino,
        subtitulo,
        clienteId,
        vencido: s.fecha < ahora,
        notificar: s.notificar ?? false,
      });
    }

    const lista = [...grupos.values()].map((g) => {
      // Vencidos primero; luego por fecha ascendente.
      g.items.sort((a, b) => (a.vencido !== b.vencido ? (a.vencido ? -1 : 1) : a.fecha - b.fecha));
      return {
        ...g,
        total: g.items.length,
        vencidos: g.items.filter((i) => i.vencido).length,
      };
    });
    // Más carga primero; a igualdad, por nombre.
    lista.sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));

    const items = lista.flatMap((g) => g.items);
    return {
      grupos: lista,
      totalPendientes: items.length,
      totalVencidos: items.filter((i) => i.vencido).length,
      totalEmpleados: lista.length,
    };
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
  // Escritura: el observador (solo lectura, JUA-42) no gestiona seguimientos,
  // ni siquiera los propios.
  const sesion = await resolverSesionEscritura(ctx, token);
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
    if (seguimiento.frecuencia === "mensual" && diaRecurrencia != null && !esDiaDelMesValido(diaRecurrencia)) {
      throw new Error("Día de recurrencia no válido");
    }
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
