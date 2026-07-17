import { internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";

// Alta automatizada de negocios (JUA-41). Funciones INTERNAS: solo se ejecutan
// desde el CLI/dashboard con credenciales de administrador (`npx convex run`),
// igual que `seed`. No hay endpoint público — la superficie de alta de negocios
// (privilegio máximo: crea un negocio y su primer admin) no queda expuesta. El
// registro público autoservicio es otra tarea (JUA-39).
//
// Envío del email: el correo de invitación por Resend está pendiente en el
// proyecto (hoy las invitaciones se comparten con "copiar enlace"). Aquí se crea
// la invitación y se devuelve el enlace de activación para compartirlo.

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/; // misma regla que usuarios/invitaciones
const ZONA_DEFECTO = "America/Mexico_City"; // el admin la fija al activar (JUA-8)
const NOMBRE_MAX = 80;

/**
 * Crea un negocio nuevo y la invitación de su PRIMER administrador, sin acceso
 * directo a la base de datos (JUA-41). Valida el email y la unicidad global (un
 * email = un usuario en toda la app; un `emailAdmin` = un negocio). No reutiliza
 * `usuarios.invitar` porque ese exige una sesión admin y aquí el negocio aún no
 * tiene ninguno. El admin fija su contraseña y la zona horaria al activar
 * (`invitaciones.activar`). Devuelve el token de activación (y el enlace, si se
 * pasa `baseUrl`) para componer `…/activar?token=<token>`.
 */
export const crearNegocio = internalMutation({
  args: {
    nombre: v.string(),
    emailAdmin: v.string(),
    zonaHoraria: v.optional(v.string()),
    baseUrl: v.optional(v.string()), // origen para componer el enlace de activación
  },
  handler: async (ctx, { nombre, emailAdmin, zonaHoraria, baseUrl }) => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) throw new ConvexError("El nombre del negocio es obligatorio");
    if (nombreLimpio.length > NOMBRE_MAX) throw new ConvexError("El nombre del negocio es demasiado largo");

    const correo = emailAdmin.trim().toLowerCase();
    if (!EMAIL_RE.test(correo)) throw new ConvexError("Email del administrador no válido");

    // Unicidad global: ni un usuario ni un negocio ya usan ese email.
    const usuarioExistente = await ctx.db
      .query("usuarios")
      .withIndex("por_email", (q) => q.eq("email", correo))
      .first();
    if (usuarioExistente) throw new ConvexError("Ya existe una cuenta con ese email");

    const negocioExistente = await ctx.db
      .query("negocios")
      .filter((q) => q.eq(q.field("emailAdmin"), correo))
      .first();
    if (negocioExistente) throw new ConvexError("Ya existe un negocio con ese email de administrador");

    const ahora = Date.now();
    const negocioId = await ctx.db.insert("negocios", {
      nombre: nombreLimpio,
      emailAdmin: correo,
      zonaHoraria: zonaHoraria?.trim() || ZONA_DEFECTO,
      estado: "activo",
    });

    const token = bytesToHex(randomBytes(32));
    const invitacionId = await ctx.db.insert("invitaciones", {
      negocioId,
      email: correo,
      rol: "admin",
      estado: "pendiente",
      token,
      expiraEn: ahora + SIETE_DIAS_MS,
    });

    const base = baseUrl?.trim().replace(/\/+$/, "");
    return {
      negocioId,
      invitacionId,
      emailAdmin: correo,
      token,
      enlaceActivacion: base ? `${base}/activar?token=${token}` : null,
    };
  },
});

/**
 * Lista los negocios con su estado y el de activación de su admin (JUA-41):
 * cumple el criterio "el negocio queda visible en el listado". Interno
 * (gestión/soporte). No expone tokens ni credenciales.
 */
export const listarNegocios = internalQuery({
  args: {},
  handler: async (ctx) => {
    const negocios = await ctx.db.query("negocios").collect();
    const filas = [];
    for (const n of negocios) {
      const usuarios = await ctx.db
        .query("usuarios")
        .withIndex("por_negocio", (q) => q.eq("negocioId", n._id))
        .collect();
      const invitaciones = await ctx.db
        .query("invitaciones")
        .withIndex("por_negocio", (q) => q.eq("negocioId", n._id))
        .collect();
      const adminActivo = usuarios.some((u) => u.rol === "admin" && u.estado === "activo");
      const invAdminPendiente = invitaciones.some((i) => i.rol === "admin" && i.estado === "pendiente");
      filas.push({
        negocioId: n._id,
        nombre: n.nombre,
        emailAdmin: n.emailAdmin,
        estado: n.estado,
        zonaHoraria: n.zonaHoraria,
        usuarios: usuarios.length,
        // Estado del onboarding del admin: activo / invitación pendiente / sin invitación.
        admin: adminActivo ? "activo" : invAdminPendiente ? "pendiente" : "sin_invitacion",
      });
    }
    return filas.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },
});

// --- Helper SOLO para pruebas (dev) -----------------------------------------
// Borra un negocio de PRUEBA y sus dependientes directos (usuarios + sus sesiones
// + invitaciones) para que los drivers de JUA-41 no dejen residuo. Interno y
// gateado por `QA_HELPERS=1` (solo dev; inerte en prod, donde la variable no
// existe). El auditor admitió estos helpers como vía de limpieza en pruebas.

/** Borra un negocio y sus dependientes directos (solo pruebas, dev). */
export const qaBorrarNegocio = internalMutation({
  args: { negocioId: v.id("negocios") },
  handler: async (ctx, { negocioId }) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    const usuarios = await ctx.db
      .query("usuarios")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();
    for (const u of usuarios) {
      const sesiones = await ctx.db
        .query("sesiones")
        .withIndex("por_usuario", (q) => q.eq("usuarioId", u._id))
        .collect();
      for (const s of sesiones) await ctx.db.delete(s._id);
      await ctx.db.delete(u._id);
    }
    const invitaciones = await ctx.db
      .query("invitaciones")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();
    for (const i of invitaciones) await ctx.db.delete(i._id);
    await ctx.db.delete(negocioId);
    return { usuarios: usuarios.length, invitaciones: invitaciones.length };
  },
});
