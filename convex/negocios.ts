import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { encolar } from "./emailCola";

// Alta y soporte inicial de negocios (JUA-41). Funciones INTERNAS: solo se
// ejecutan desde el CLI/dashboard con credenciales de administrador
// (`npx convex run`), igual que `seed`. No hay endpoint público — la superficie
// de alta de negocios (privilegio máximo: crea un negocio y su primer admin) no
// queda expuesta. El registro público autoservicio es otra tarea (JUA-39).
//
// El objetivo de JUA-41 es alta Y SOPORTE INICIAL sin acceso directo a la BD, así
// que además de `crearNegocio` hay operaciones de recuperación (`reemitirAdminInicial`,
// `cancelarNegocioVacio`) para los estados en que el primer admin quedó pendiente
// (invitación expirada, email equivocado, o email tomado por otra cuenta antes de
// activar). Sin ellas el equipo volvería a necesitar tocar la BD (obs. B-1 dictamen).
//
// Envío del email: el correo de invitación por Resend está pendiente en el
// proyecto (hoy las invitaciones se comparten con "copiar enlace"). Estas funciones
// crean la invitación y devuelven el enlace de activación para compartirlo.

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/; // misma regla que usuarios/invitaciones
const EMAIL_ADMIN_DEMO = "marta@demo.mx"; // negocio demo (seed): nunca borrable por QA
const ZONA_DEFECTO = "America/Mexico_City"; // el admin la fija al activar (JUA-8)
const NOMBRE_MAX = 80;

/** ¿Es una zona horaria IANA válida? (obs. OBS-1). Intl lanza RangeError si no. */
function zonaValida(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Nombre de negocio saneado, o ConvexError. */
function validarNombre(nombre: string): string {
  const n = nombre.trim();
  if (!n) throw new ConvexError("El nombre del negocio es obligatorio");
  if (n.length > NOMBRE_MAX) throw new ConvexError("El nombre del negocio es demasiado largo");
  return n;
}

/** Zona horaria saneada (por defecto `America/Mexico_City`), validada IANA (OBS-1). */
function validarZona(zonaHoraria: string | undefined): string {
  const z = zonaHoraria?.trim() || ZONA_DEFECTO;
  if (!zonaValida(z)) throw new ConvexError("Zona horaria no válida (usa una zona IANA, p. ej. America/Mexico_City)");
  return z;
}

/** `baseUrl` (opcional) debe ser una URL https válida (obs. OBS-1). */
function validarBaseUrl(baseUrl: string | undefined): void {
  if (baseUrl == null || baseUrl.trim() === "") return;
  try {
    if (new URL(baseUrl.trim()).protocol !== "https:") throw new Error();
  } catch {
    throw new ConvexError("baseUrl debe ser una URL https válida");
  }
}

/**
 * Normaliza el email y verifica la UNICIDAD GLOBAL: ni un usuario (índice `por_email`)
 * ni OTRO negocio (índice `por_email_admin`, excluyendo `negocioIdExcluir`) lo usan.
 * Devuelve el email normalizado o lanza ConvexError.
 */
async function validarEmailAdminLibre(
  ctx: MutationCtx,
  emailRaw: string,
  negocioIdExcluir?: Id<"negocios">,
): Promise<string> {
  const correo = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(correo)) throw new ConvexError("Email del administrador no válido");
  const usuario = await ctx.db.query("usuarios").withIndex("por_email", (q) => q.eq("email", correo)).first();
  if (usuario) throw new ConvexError("Ya existe una cuenta con ese email");
  const negocio = await ctx.db.query("negocios").withIndex("por_email_admin", (q) => q.eq("emailAdmin", correo)).first();
  if (negocio && negocio._id !== negocioIdExcluir) throw new ConvexError("Ya existe un negocio con ese email de administrador");
  return correo;
}

/** Crea una invitación admin de un solo uso (7 días) y compone el enlace. Uso interno. */
async function crearInvitacionAdmin(ctx: MutationCtx, negocioId: Id<"negocios">, correo: string, baseUrl: string | undefined) {
  const token = bytesToHex(randomBytes(32));
  const invitacionId = await ctx.db.insert("invitaciones", {
    negocioId,
    email: correo,
    rol: "admin",
    estado: "pendiente",
    token,
    expiraEn: Date.now() + SIETE_DIAS_MS,
  });
  // Envía el enlace de activación del primer admin por correo (JUA-129). El retorno con
  // el enlace se conserva (el operador del CLI lo comparte como fallback); el envío es
  // durable e inerte sin Resend.
  await encolar(ctx, { tipo: "invitacion", invitacionId });
  const base = baseUrl?.trim().replace(/\/+$/, "");
  return { invitacionId, token, enlaceActivacion: base ? `${base}/activar?token=${token}` : null };
}

/** ¿Tiene el negocio un administrador ACTIVO? (bloquea reemisión/cancelación). */
async function tieneAdminActivo(ctx: MutationCtx, negocioId: Id<"negocios">): Promise<boolean> {
  const usuarios = await ctx.db.query("usuarios").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect();
  return usuarios.some((u) => u.rol === "admin" && u.estado === "activo");
}

/**
 * Crea un negocio nuevo y la invitación de su PRIMER administrador, sin acceso
 * directo a la base de datos (JUA-41). Valida nombre, zona (IANA), baseUrl (https)
 * y la unicidad global del email. El admin fija su contraseña y la zona horaria al
 * activar (`invitaciones.activar`). Devuelve el token de activación (y el enlace,
 * si se pasa `baseUrl`) para componer `…/activar?token=<token>`.
 */
export const crearNegocio = internalMutation({
  args: {
    nombre: v.string(),
    emailAdmin: v.string(),
    zonaHoraria: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
  },
  handler: async (ctx, { nombre, emailAdmin, zonaHoraria, baseUrl }) => {
    const nombreLimpio = validarNombre(nombre);
    const zona = validarZona(zonaHoraria);
    validarBaseUrl(baseUrl);
    const correo = await validarEmailAdminLibre(ctx, emailAdmin);

    const negocioId = await ctx.db.insert("negocios", {
      nombre: nombreLimpio,
      emailAdmin: correo,
      zonaHoraria: zona,
      estado: "activo",
    });
    const inv = await crearInvitacionAdmin(ctx, negocioId, correo, baseUrl);
    return { negocioId, invitacionId: inv.invitacionId, emailAdmin: correo, token: inv.token, enlaceActivacion: inv.enlaceActivacion };
  },
});

/**
 * Recupera un alta inicial fallida SIN tocar la BD (obs. B-1): reemite la invitación
 * del primer admin cuando la anterior expiró, se capturó un email equivocado, o el
 * email quedó tomado por otra cuenta antes de activar. Solo opera si el negocio NO
 * tiene un admin activo. Si se pasa `emailAdmin`, corrige el correo del negocio
 * (validando unicidad global). Invalida las invitaciones admin pendientes (el token
 * viejo deja de servir) y crea una nueva de un solo uso. Devuelve el enlace nuevo.
 */
export const reemitirAdminInicial = internalMutation({
  args: {
    negocioId: v.id("negocios"),
    emailAdmin: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
  },
  handler: async (ctx, { negocioId, emailAdmin, baseUrl }) => {
    const negocio = await ctx.db.get(negocioId);
    if (!negocio) throw new ConvexError("Negocio no encontrado");
    validarBaseUrl(baseUrl);
    if (await tieneAdminActivo(ctx, negocioId)) {
      throw new ConvexError("El negocio ya tiene un administrador activo; no se reemite la invitación inicial");
    }

    // Email destino: el corregido (si se pasa) o el actual. En ambos casos se valida
    // la unicidad global (cubre el caso de que otra cuenta tomara el email).
    const correoRaw = emailAdmin != null && emailAdmin.trim() !== "" ? emailAdmin : negocio.emailAdmin;
    const correo = await validarEmailAdminLibre(ctx, correoRaw, negocioId);

    // Invalida las invitaciones admin pendientes de este negocio (revoca el token viejo).
    const invs = await ctx.db.query("invitaciones").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect();
    for (const i of invs) {
      if (i.rol === "admin" && i.estado === "pendiente") await ctx.db.patch(i._id, { estado: "expirada" });
    }
    if (correo !== negocio.emailAdmin) await ctx.db.patch(negocioId, { emailAdmin: correo });

    const inv = await crearInvitacionAdmin(ctx, negocioId, correo, baseUrl);
    return { negocioId, invitacionId: inv.invitacionId, emailAdmin: correo, token: inv.token, enlaceActivacion: inv.enlaceActivacion };
  },
});

/**
 * Cancela de forma segura un negocio que todavía está VACÍO (alta equivocada o
 * duplicada), sin tocar la BD (complemento de la obs. B-1). Solo si no tiene NINGÚN
 * usuario ni cliente; borra sus invitaciones pendientes y el negocio. Nunca borra un
 * negocio con datos.
 */
export const cancelarNegocioVacio = internalMutation({
  args: { negocioId: v.id("negocios") },
  handler: async (ctx, { negocioId }) => {
    const negocio = await ctx.db.get(negocioId);
    if (!negocio) throw new ConvexError("Negocio no encontrado");
    const usuarios = await ctx.db.query("usuarios").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect();
    if (usuarios.length > 0) throw new ConvexError("El negocio ya tiene usuarios; no es un alta vacía");
    const clientes = await ctx.db.query("clientes").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect();
    if (clientes.length > 0) throw new ConvexError("El negocio ya tiene datos; no es un alta vacía");

    const invs = await ctx.db.query("invitaciones").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect();
    for (const i of invs) await ctx.db.delete(i._id);
    await ctx.db.delete(negocioId);
    return { invitaciones: invs.length };
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
      const usuarios = await ctx.db.query("usuarios").withIndex("por_negocio", (q) => q.eq("negocioId", n._id)).collect();
      const invitaciones = await ctx.db.query("invitaciones").withIndex("por_negocio", (q) => q.eq("negocioId", n._id)).collect();
      const adminActivo = usuarios.some((u) => u.rol === "admin" && u.estado === "activo");
      const invAdminPendiente = invitaciones.some((i) => i.rol === "admin" && i.estado === "pendiente");
      filas.push({
        negocioId: n._id,
        nombre: n.nombre,
        emailAdmin: n.emailAdmin,
        estado: n.estado,
        zonaHoraria: n.zonaHoraria,
        usuarios: usuarios.length,
        // Onboarding del admin: activo / invitación pendiente / sin invitación vigente.
        admin: adminActivo ? "activo" : invAdminPendiente ? "pendiente" : "sin_invitacion",
      });
    }
    return filas.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },
});

// --- Helper SOLO para pruebas (dev) -----------------------------------------
// Borra un negocio de PRUEBA y sus dependientes directos (usuarios + sesiones +
// invitaciones). Interno y gateado por `QA_HELPERS=1` (solo dev, inerte en prod).
// Guard basado en DATOS (obs. OBS-3, más robusto que un patrón de email): nunca el
// negocio demo, y solo si NO tiene clientes — los negocios con datos reales quedan
// protegidos (el demo, que siempre tiene clientes, también).

/** Borra un negocio de prueba SIN clientes (nunca el demo) y sus dependientes (solo pruebas, dev). */
export const qaBorrarNegocio = internalMutation({
  args: { negocioId: v.id("negocios") },
  handler: async (ctx, { negocioId }) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    const negocio = await ctx.db.get(negocioId);
    if (!negocio) throw new Error("Negocio no encontrado");
    if (negocio.emailAdmin === EMAIL_ADMIN_DEMO) throw new Error("No se borra el negocio demo");
    const conClientes = await ctx.db.query("clientes").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).first();
    if (conClientes) throw new Error("qaBorrarNegocio solo borra negocios SIN clientes (protege datos reales)");
    const usuarios = await ctx.db.query("usuarios").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect();
    for (const u of usuarios) {
      const sesiones = await ctx.db.query("sesiones").withIndex("por_usuario", (q) => q.eq("usuarioId", u._id)).collect();
      for (const s of sesiones) await ctx.db.delete(s._id);
      await ctx.db.delete(u._id);
    }
    const invitaciones = await ctx.db.query("invitaciones").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect();
    for (const i of invitaciones) await ctx.db.delete(i._id);
    await ctx.db.delete(negocioId);
    return { usuarios: usuarios.length, invitaciones: invitaciones.length };
  },
});
