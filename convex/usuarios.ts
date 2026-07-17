import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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
        // Activo pero aún sin fijar su contraseña (reactivación en curso,
        // JUA-125): la UI ofrece regenerar el enlace de nueva contraseña.
        enlacePendiente: u.estado === "activo" && !u.passwordHash,
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

    // Solo usuarios que pueden ATENDER seguimientos: el observador (solo lectura,
    // JUA-42) no es asignable como responsable ni destino, así que se excluye.
    const usuarios = (
      await ctx.db
        .query("usuarios")
        .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
        .collect()
    ).filter((u) => u.estado === "activo" && u.rol !== "observador");

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

    // Carga por miembro (JUA-126, obs. OBS-2): es información de gestión, solo para
    // el admin. Al operativo se le devuelve la lista (nombres/roles, que necesita
    // para elegirse a sí mismo y ver responsables) pero SIN la carga de sus colegas.
    const esAdmin = sesion.usuario.rol === "admin";
    return {
      soyAdmin: esAdmin,
      miId: sesion.usuario._id,
      usuarios: usuarios.map((u) => ({
        _id: u._id,
        nombre: u.nombre,
        rol: u.rol,
        clientes: esAdmin ? (clientesPorResponsable.get(u._id) ?? 0) : null,
        esYo: u._id === sesion.usuario._id,
      })),
    };
  },
});

/**
 * Invita a un usuario (JUA-29). Crea una invitación pendiente con token y 7 días
 * de vigencia. Rechaza si ya existe un usuario con ese email o una invitación
 * pendiente vigente. Solo admin. Los rechazos de validación usan `ConvexError`
 * para que el motivo llegue al cliente también en producción (lección JUA-120).
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
    if (!EMAIL_RE.test(correo)) throw new ConvexError("Email no válido");

    // Unicidad GLOBAL (un email = un usuario en toda la app), igual que en
    // `invitaciones.activar`: evita invitaciones condenadas a fallar al activar
    // si el email ya existe en otro negocio.
    const existente = await ctx.db
      .query("usuarios")
      .withIndex("por_email", (q) => q.eq("email", correo))
      .first();
    if (existente) throw new ConvexError("Ya existe una cuenta con ese email");

    const ahora = Date.now();
    const invs = await ctx.db
      .query("invitaciones")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    if (invs.some((i) => i.email.toLowerCase() === correo && i.estado === "pendiente" && i.expiraEn > ahora)) {
      throw new ConvexError("Ya hay una invitación pendiente para ese email");
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

/** Elimina todas las sesiones de un usuario (hardening JUA-125). */
async function eliminarSesiones(ctx: MutationCtx, usuarioId: Id<"usuarios">) {
  const sesiones = await ctx.db
    .query("sesiones")
    .withIndex("por_usuario", (q) => q.eq("usuarioId", usuarioId))
    .collect();
  for (const s of sesiones) await ctx.db.delete(s._id);
}

/**
 * Revoca (desactiva) el acceso de un usuario. No puede iniciar sesión, pero sus
 * notas, registros e historial se conservan. No permite desactivarse a uno mismo
 * ni dejar el negocio sin ningún admin activo. Solo admin. Elimina todas sus
 * sesiones (JUA-125): la revocación surte efecto inmediato, sin sesiones vivas.
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
    await eliminarSesiones(ctx, usuarioId);
    // Al revocar, elimina también sus suscripciones push (JUA-33, obs. B-2): no se
    // retienen endpoints/claves de una cuenta desactivada y deja de recibir avisos.
    const subs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("por_usuario", (q) => q.eq("usuarioId", usuarioId))
      .collect();
    for (const s of subs) await ctx.db.delete(s._id);
  },
});

// Vigencia del enlace de contraseña emitido al reactivar (igual que JUA-7).
const REACTIVACION_MS = 24 * 60 * 60 * 1000;

/**
 * Reactiva a un usuario desactivado. Solo admin; usuario del propio negocio.
 * Hardening JUA-125: reactivar NO revalida la credencial anterior — anula la
 * contraseña, elimina las sesiones que quedaran y emite un enlace de "nueva
 * contraseña" (recuperación JUA-7, 24 h, un solo uso) que el admin comparte
 * manualmente (como el "Copiar enlace" de las invitaciones). Devuelve el token.
 *
 * Estados admisibles (B-1 del dictamen v1): SOLO un usuario `inactivo`
 * (reactivación) o uno `activo` SIN contraseña (regenerar un enlace pendiente,
 * B-2). Nunca una cuenta activa con contraseña — eso permitiría convertir una
 * sesión admin en control persistente de cualquier cuenta esquivando el
 * requisito de contraseña actual de `auth.cambiarPassword` — y nunca la propia
 * cuenta de quien ejecuta. Se rechaza ANTES de modificar nada.
 */
export const reactivar = mutation({
  args: { token: v.string(), usuarioId: v.id("usuarios") },
  handler: async (ctx, { token, usuarioId }) => {
    const sesion = await sesionAdmin(ctx, token);
    if (!sesion) throw new Error("No autorizado");
    if (usuarioId === sesion.usuario._id) throw new Error("No puedes reactivar tu propia cuenta");

    const usuario = await ctx.db.get(usuarioId);
    if (!usuario || usuario.negocioId !== sesion.negocioId) throw new Error("No encontrado");

    const enlacePendiente = usuario.estado === "activo" && !usuario.passwordHash;
    if (usuario.estado !== "inactivo" && !enlacePendiente) {
      throw new Error("Solo se puede reactivar a un usuario revocado");
    }

    await ctx.db.patch(usuarioId, {
      estado: "activo",
      passwordHash: undefined,
      intentosFallidos: 0,
      bloqueadoHasta: undefined,
    });
    await eliminarSesiones(ctx, usuarioId);

    // Un solo enlace vigente: se invalidan los de recuperación previos.
    const previos = await ctx.db
      .query("recuperaciones")
      .withIndex("por_usuario", (q) => q.eq("usuarioId", usuarioId))
      .collect();
    for (const p of previos) await ctx.db.delete(p._id);

    const tokenRecuperacion = bytesToHex(randomBytes(32));
    await ctx.db.insert("recuperaciones", {
      usuarioId,
      token: tokenRecuperacion,
      expiraEn: Date.now() + REACTIVACION_MS,
    });
    return { token: tokenRecuperacion };
  },
});
