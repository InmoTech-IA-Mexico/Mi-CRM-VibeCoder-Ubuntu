import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { resolverSesion } from "./auth";

// Lista de clientes del negocio (JUA-14). Devuelve todos (excepto papelera) con
// los campos para el buscador en tiempo real (nombre/teléfono/email/empresa) y la
// etapa de la oportunidad abierta más reciente. El filtrado por texto se hace en
// el cliente (instantáneo, sin round-trip por tecla). El `negocioId` sale de la
// sesión (JUA-10), nunca del payload del cliente.
const ETAPAS_CERRADAS = ["ganada", "perdida", "cancelada"];

export const listar = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return [];
    const negocioId = sesion.negocioId;

    const clientes = await ctx.db
      .query("clientes")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();

    const rows = await Promise.all(
      clientes
        .filter((c) => c.eliminadoEn == null)
        .map(async (c) => {
          const opos = await ctx.db
            .query("oportunidades")
            .withIndex("por_cliente", (q) => q.eq("clienteId", c._id))
            .order("desc")
            .collect();
          const abierta = opos.find((o) => !ETAPAS_CERRADAS.includes(o.etapa));
          return {
            _id: c._id,
            nombre: c.nombre,
            telefono: c.telefono ?? null,
            email: c.email ?? null,
            empresa: c.empresa ?? null,
            estado: c.estado,
            prioridad: c.prioridad ?? null,
            ultimaInteraccion: c.ultimaInteraccion ?? c._creationTime,
            etapa: abierta?.etapa ?? null,
          };
        }),
    );

    // Orden por defecto: Nombre A-Z (como marca el diseño).
    rows.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return rows;
  },
});

// Estados a los que el usuario puede pasar el cliente MANUALMENTE (JUA-13).
// `nuevo` e `inactivo` tienen reglas automáticas y no se fijan a mano.
const ESTADOS_MANUALES = ["prospecto", "activo", "descartado"] as const;

/**
 * Ficha completa de un cliente (JUA-13). Devuelve sus datos, las oportunidades
 * y los seguimientos pendientes. Valida pertenencia al negocio de la sesión
 * (JUA-10): un cliente de otro negocio, inexistente o en papelera → `null`
 * (el cliente muestra "no encontrado", sin revelar si existe).
 */
export const detalle = query({
  // `clienteId` llega de la URL, así que puede venir malformado: se acepta como
  // string y se normaliza (id inválido → null → "no encontrado"), evitando un
  // error de validación y sin revelar si existe (JUA-10).
  args: { token: v.string(), clienteId: v.string() },
  handler: async (ctx, { token, clienteId }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return null;

    const id = ctx.db.normalizeId("clientes", clienteId);
    if (!id) return null;
    const c = await ctx.db.get(id);
    if (!c || c.negocioId !== sesion.negocioId || c.eliminadoEn != null) return null;

    const opos = await ctx.db
      .query("oportunidades")
      .withIndex("por_cliente", (q) => q.eq("clienteId", id))
      .order("desc")
      .collect();

    const seguimientos = await ctx.db
      .query("seguimientos")
      .withIndex("por_cliente", (q) => q.eq("clienteId", id))
      .collect();
    const pendientes = seguimientos
      .filter((s) => s.estado === "pendiente")
      .sort((a, b) => a.fecha - b.fecha);

    return {
      _id: c._id,
      nombre: c.nombre,
      tipo: c.tipo ?? null,
      telefono: c.telefono ?? null,
      email: c.email ?? null,
      empresa: c.empresa ?? null,
      cargo: c.cargo ?? null,
      direccion: c.direccion ?? null,
      canal: c.canal ?? null,
      estado: c.estado,
      prioridad: c.prioridad ?? null,
      observaciones: c.observaciones ?? null,
      ultimaInteraccion: c.ultimaInteraccion ?? null,
      creadoEn: c._creationTime,
      oportunidades: opos.map((o) => ({
        _id: o._id,
        nombre: o.nombre,
        etapa: o.etapa,
        monto: o.monto ?? null,
        fechaCierre: o.fechaCierre ?? null,
      })),
      seguimientos: pendientes.map((s) => ({
        _id: s._id,
        titulo: s.titulo,
        fecha: s.fecha,
        hora: s.hora ?? null,
        prioridad: s.prioridad,
      })),
    };
  },
});

/** Cambia el estado del cliente manualmente (JUA-13). Valida pertenencia. */
export const cambiarEstado = mutation({
  args: {
    token: v.string(),
    clienteId: v.id("clientes"),
    estado: v.union(v.literal("prospecto"), v.literal("activo"), v.literal("descartado")),
  },
  handler: async (ctx, { token, clienteId, estado }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const c = await ctx.db.get(clienteId);
    if (!c || c.negocioId !== sesion.negocioId || c.eliminadoEn != null) {
      throw new Error("No encontrado");
    }
    if (!ESTADOS_MANUALES.includes(estado)) throw new Error("Estado no permitido");

    await ctx.db.patch(clienteId, { estado, actualizadoEn: Date.now() });
  },
});

/**
 * Envía el cliente a la papelera (soft delete). Solo Marta (admin) puede
 * eliminar clientes (JUA-13). Valida pertenencia al negocio de la sesión.
 */
export const enviarAPapelera = mutation({
  args: { token: v.string(), clienteId: v.id("clientes") },
  handler: async (ctx, { token, clienteId }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) throw new Error("No autorizado");
    if (sesion.usuario.rol !== "admin") throw new Error("Solo el administrador puede eliminar clientes");

    const c = await ctx.db.get(clienteId);
    if (!c || c.negocioId !== sesion.negocioId || c.eliminadoEn != null) {
      throw new Error("No encontrado");
    }

    const ahora = Date.now();
    await ctx.db.patch(clienteId, { eliminadoEn: ahora, actualizadoEn: ahora });
  },
});
