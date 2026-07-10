import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { resolverSesion } from "./auth";
import { rol as rolValidator } from "./schema";

// Gestión de usuarios del negocio (JUA-29). Solo admin. Invitar / reenviar
// invitación / revocar (desactivar) / reactivar. El aislamiento por negocio
// (JUA-10) se deriva de la sesión. El envío real del email de invitación y la
// pantalla de aceptación (fijar contraseña) son JUA-8/9.

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Resuelve la sesión y exige rol admin. Devuelve null si no procede. */
async function sesionAdmin(ctx: QueryCtx | MutationCtx, token: string) {
  const sesion = await resolverSesion(ctx, token);
  if (!sesion || sesion.usuario.rol !== "admin") return null;
  return sesion;
}

/**
 * Lista el equipo (usuarios activos/inactivos) y las invitaciones pendientes o
 * expiradas del negocio. Solo admin. Marca `esYo` en el usuario de la sesión y
 * recalcula "expirada" con el tiempo del servidor.
 */
export const listar = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await sesionAdmin(ctx, token);
    if (!sesion) return null;
    const ahora = Date.now();

    const usuarios = await ctx.db
      .query("usuarios")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    const invitaciones = await ctx.db
      .query("invitaciones")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();

    // Orden: admins primero, luego por nombre.
    usuarios.sort((a, b) =>
      a.rol === b.rol ? a.nombre.localeCompare(b.nombre, "es") : a.rol === "admin" ? -1 : 1,
    );

    return {
      usuarios: usuarios.map((u) => ({
        _id: u._id,
        nombre: u.nombre,
        email: u.email,
        rol: u.rol,
        estado: u.estado,
        esYo: u._id === sesion.usuario._id,
      })),
      invitaciones: invitaciones
        .filter((i) => i.estado !== "aceptada")
        .map((i) => {
          const expirada = i.estado === "expirada" || i.expiraEn <= ahora;
          return {
            _id: i._id,
            email: i.email,
            nombre: i.nombre ?? null,
            rol: i.rol,
            token: i.token, // para construir el enlace de activación (copiar enlace)
            creadoEn: i._creationTime,
            expiraEn: i.expiraEn,
            estado: expirada ? ("expirada" as const) : ("pendiente" as const),
            diasRestantes: expirada ? 0 : Math.max(1, Math.ceil((i.expiraEn - ahora) / (24 * 60 * 60 * 1000))),
          };
        })
        .sort((a, b) => b.creadoEn - a.creadoEn),
    };
  },
});

/**
 * Actualiza los datos personales del propio usuario (JUA-120): nombre y email.
 * Cualquier rol edita **su** cuenta. El email es único a nivel global (un email =
 * un usuario en toda la app); se normaliza a minúsculas.
 */
export const actualizarPerfil = mutation({
  args: { token: v.string(), nombre: v.string(), email: v.string() },
  handler: async (ctx, { token, nombre, email }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    // ConvexError para que el mensaje llegue al cliente también en producción.
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) throw new ConvexError("El nombre es obligatorio");

    const correo = email.trim().toLowerCase();
    if (!EMAIL_RE.test(correo)) throw new ConvexError("Email no válido");

    // Unicidad global: ningún OTRO usuario puede tener ese email.
    const existente = await ctx.db
      .query("usuarios")
      .withIndex("por_email", (q) => q.eq("email", correo))
      .first();
    if (existente && existente._id !== sesion.usuario._id) {
      throw new ConvexError("Ya existe una cuenta con ese email");
    }

    await ctx.db.patch(sesion.usuario._id, { nombre: nombreLimpio, email: correo });
  },
});

/**
 * Equipo activo del negocio (JUA-119), para los selectores de "asignar
 * seguimiento a" y "seguimiento a un empleado". Disponible para AMBOS roles
 * (a diferencia de `listar`, que es solo admin). Devuelve los usuarios activos
 * con su nº de clientes a cargo; marca `esYo` en el usuario de la sesión. El
 * aislamiento por negocio (JUA-10) se deriva de la sesión.
 */
export const equipo = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return null;

    const usuarios = (
      await ctx.db
        .query("usuarios")
        .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
        .collect()
    ).filter((u) => u.estado === "activo");

    const clientes = (
      await ctx.db
        .query("clientes")
        .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
        .collect()
    ).filter((c) => c.eliminadoEn == null);
    const clientesPorResponsable = new Map<string, number>();
    for (const c of clientes) {
      if (c.responsableId) {
        clientesPorResponsable.set(c.responsableId, (clientesPorResponsable.get(c.responsableId) ?? 0) + 1);
      }
    }

    // Orden: yo primero, luego admins, luego por nombre.
    usuarios.sort((a, b) => {
      const yoA = a._id === sesion.usuario._id;
      const yoB = b._id === sesion.usuario._id;
      if (yoA !== yoB) return yoA ? -1 : 1;
      if (a.rol !== b.rol) return a.rol === "admin" ? -1 : 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });

    return {
      soyAdmin: sesion.usuario.rol === "admin",
      miId: sesion.usuario._id,
      usuarios: usuarios.map((u) => ({
        _id: u._id,
        nombre: u.nombre,
        rol: u.rol,
        clientes: clientesPorResponsable.get(u._id) ?? 0,
        esYo: u._id === sesion.usuario._id,
      })),
    };
  },
});

/**
 * Invita a un usuario (JUA-29). Crea una invitación pendiente con token y 7 días
 * de vigencia. Rechaza si ya existe un usuario con ese email o una invitación
 * pendiente vigente. Solo admin.
 */
export const invitar = mutation({
  args: {
    token: v.string(),
    email: v.string(),
    nombre: v.optional(v.string()),
    rol: rolValidator,
  },
  handler: async (ctx, { token, email, nombre, rol }) => {
    const sesion = await sesionAdmin(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const correo = email.trim().toLowerCase();
    if (!EMAIL_RE.test(correo)) throw new Error("Email no válido");

    const usuarios = await ctx.db
      .query("usuarios")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    if (usuarios.some((u) => u.email.toLowerCase() === correo)) {
      throw new Error("Ya existe un usuario con ese email");
    }

    const ahora = Date.now();
    const invs = await ctx.db
      .query("invitaciones")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    if (invs.some((i) => i.email.toLowerCase() === correo && i.estado === "pendiente" && i.expiraEn > ahora)) {
      throw new Error("Ya hay una invitación pendiente para ese email");
    }

    return await ctx.db.insert("invitaciones", {
      negocioId: sesion.negocioId,
      email: correo,
      nombre: nombre?.trim() || undefined,
      rol,
      estado: "pendiente",
      token: bytesToHex(randomBytes(32)),
      expiraEn: ahora + SIETE_DIAS_MS,
    });
  },
});

/**
 * Reenvía una invitación: genera un token nuevo (invalida el anterior) y renueva
 * los 7 días. Solo admin; la invitación debe ser del negocio y no estar aceptada.
 */
export const reenviar = mutation({
  args: { token: v.string(), invitacionId: v.id("invitaciones") },
  handler: async (ctx, { token, invitacionId }) => {
    const sesion = await sesionAdmin(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const inv = await ctx.db.get(invitacionId);
    if (!inv || inv.negocioId !== sesion.negocioId) throw new Error("No encontrado");
    if (inv.estado === "aceptada") throw new Error("La invitación ya fue aceptada");

    await ctx.db.patch(invitacionId, {
      token: bytesToHex(randomBytes(32)),
      estado: "pendiente",
      expiraEn: Date.now() + SIETE_DIAS_MS,
    });
  },
});

/**
 * Revoca (desactiva) el acceso de un usuario. No puede iniciar sesión, pero sus
 * notas, registros e historial se conservan. No permite desactivarse a uno mismo
 * ni dejar el negocio sin ningún admin activo. Solo admin.
 */
export const desactivar = mutation({
  args: { token: v.string(), usuarioId: v.id("usuarios") },
  handler: async (ctx, { token, usuarioId }) => {
    const sesion = await sesionAdmin(ctx, token);
    if (!sesion) throw new Error("No autorizado");
    if (usuarioId === sesion.usuario._id) throw new Error("No puedes desactivar tu propia cuenta");

    const usuario = await ctx.db.get(usuarioId);
    if (!usuario || usuario.negocioId !== sesion.negocioId) throw new Error("No encontrado");

    if (usuario.rol === "admin") {
      const usuarios = await ctx.db
        .query("usuarios")
        .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
        .collect();
      const adminsActivos = usuarios.filter((u) => u.rol === "admin" && u.estado === "activo");
      if (adminsActivos.length <= 1) throw new Error("Debe quedar al menos un administrador activo");
    }

    await ctx.db.patch(usuarioId, { estado: "inactivo" });
  },
});

/** Reactiva a un usuario desactivado. Solo admin; usuario del propio negocio. */
export const reactivar = mutation({
  args: { token: v.string(), usuarioId: v.id("usuarios") },
  handler: async (ctx, { token, usuarioId }) => {
    const sesion = await sesionAdmin(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const usuario = await ctx.db.get(usuarioId);
    if (!usuario || usuario.negocioId !== sesion.negocioId) throw new Error("No encontrado");

    await ctx.db.patch(usuarioId, { estado: "activo" });
  },
});
