import { internalMutation, mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { hashPassword } from "./auth";
import { validarNombre, validarZona } from "./negocios";
import { encolar } from "./emailCola";

// Registro público autoservicio de nuevos negocios (JUA-39, diseño v3 con GO). El alta NO
// es una función pública invocable desde el navegador: la crea `crearPendiente` (INTERNAL),
// llamada por la httpAction `http.ts` que exige el secreto de servidor, tras que el Route
// Handler de Next verifique Turnstile y el origen Cloudflare (cierre de B-1).
//
// Flujo seguro: `crearPendiente` NO crea negocio/usuario ni reserva el email; solo un
// `registrosPendientes` con token, y envía el email de verificación (JUA-129). La cuenta se
// crea en `confirmar`, tras probar control del buzón (cierre de B-1 del NO-GO). El email es
// identidad global de login/recuperación: por eso la unicidad se reserva SOLO al confirmar.

const SESION_MS = 8 * 60 * 60 * 1000; // igual que auth/invitaciones (8 h)
const PENDIENTE_MS = 24 * 60 * 60 * 1000; // vigencia del enlace de verificación (24 h)
const VENTANA_EMAIL_MS = 5 * 60 * 1000; // throttle por email (no reemitir dentro de la ventana)
const VENTANA_GLOBAL_MS = 60 * 1000; // ventana del fusible global
const CUOTA_GLOBAL = 60; // fusible: máx. pendientes creados por VENTANA_GLOBAL_MS (cortacircuito, no único control)
const PURGA_LOTE = 200;

// Cotas de entrada ANTES de `scrypt` (caro): evitan el vector de coste no acotado (B-3).
const NOMBRE_MAX = 80;
const EMAIL_MAX = 254; // RFC 5321
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOKEN_RE = /^[0-9a-f]{64}$/; // acota el token al formato exacto antes de consultar (obs. no bloq.)

/**
 * Crea un registro PENDIENTE de verificar el email (JUA-39). INTERNAL: solo la llama la
 * httpAction tras validar el secreto de servidor (el navegador no puede invocarla). No crea
 * negocio ni usuario ni ocupa el email. Aplica cotas de input (antes de hashear), fusible
 * global acotado, throttle por email, y supersesión del pendiente anterior del mismo email
 * en la MISMA transacción. Respuesta genérica (anti-enumeración): un email ya usado o un
 * throttle devuelven `ok:true` sin crear ni revelar nada. `rate_limited` es el fusible.
 */
export const crearPendiente = internalMutation({
  args: {
    nombreNegocio: v.string(),
    nombreAdmin: v.string(),
    email: v.string(),
    password: v.string(),
    zonaHoraria: v.string(),
  },
  handler: async (ctx, { nombreNegocio, nombreAdmin, email, password, zonaHoraria }): Promise<{ ok: boolean; motivo?: string }> => {
    // 1) Cotas + validación de formato ANTES de scrypt.
    const negocio = validarNombre(nombreNegocio); // ≤80, ConvexError si no
    const persona = nombreAdmin.trim();
    if (!persona) throw new ConvexError("Tu nombre es obligatorio");
    if (persona.length > NOMBRE_MAX) throw new ConvexError("El nombre es demasiado largo");
    const correo = email.trim().toLowerCase(); // MISMA normalización que usuarios/negocios (precisión 1)
    if (correo.length > EMAIL_MAX || !EMAIL_RE.test(correo)) throw new ConvexError("Email no válido");
    if (password.length < PASSWORD_MIN) throw new ConvexError("La contraseña debe tener al menos 8 caracteres");
    if (password.length > PASSWORD_MAX) throw new ConvexError("La contraseña es demasiado larga");
    const zona = validarZona(zonaHoraria);
    const ahora = Date.now();

    // 2) Fusible global (acotado por rango, obs. B-3): si se superó la cuota en la ventana,
    //    se rechazan NUEVAS solicitudes (cortacircuito; puede afectar altas legítimas durante
    //    la ventana bajo ataque distribuido — es la última barrera, no el control primario).
    const recientes = await ctx.db
      .query("registrosPendientes")
      .withIndex("por_creado", (q) => q.gte("creadoEn", ahora - VENTANA_GLOBAL_MS))
      .take(CUOTA_GLOBAL + 1);
    if (recientes.length > CUOTA_GLOBAL) return { ok: false, motivo: "rate_limited" };

    // 3) Throttle por email (acotado): si hay un pendiente reciente del mismo email, no
    //    reemitir. Respuesta genérica (no revela que ya se solicitó).
    const reciente = await ctx.db
      .query("registrosPendientes")
      .withIndex("por_email_creado", (q) => q.eq("email", correo).gte("creadoEn", ahora - VENTANA_EMAIL_MS))
      .first();
    if (reciente) return { ok: true };

    // 4) Anti-enumeración (OBS-1): si el email YA tiene cuenta (usuario o admin de negocio),
    //    respuesta genérica SIN crear pendiente ni revelar el motivo.
    const usuarioExiste = await ctx.db.query("usuarios").withIndex("por_email", (q) => q.eq("email", correo)).first();
    const negocioExiste = await ctx.db.query("negocios").withIndex("por_email_admin", (q) => q.eq("emailAdmin", correo)).first();
    if (usuarioExiste || negocioExiste) return { ok: true };

    // 5) Supersesión por email en UNA transacción (precisión 3): borra pendientes anteriores
    //    del mismo email y descarta sus correos de salida (enlaces paralelos inútiles).
    const previos = await ctx.db.query("registrosPendientes").withIndex("por_email_creado", (q) => q.eq("email", correo)).collect();
    for (const p of previos) {
      const evs = await ctx.db.query("emailsSalientes").withIndex("por_registro", (q) => q.eq("registroPendienteId", p._id)).collect();
      for (const ev of evs) {
        if (ev.estado === "pendiente" || ev.estado === "enviando") {
          await ctx.db.patch(ev._id, { estado: "descartado", resultado: "reemplazado", leaseHasta: undefined });
        }
      }
      await ctx.db.delete(p._id);
    }

    // 6) Crea el pendiente (contraseña solo hasheada) + encola el email de verificación.
    const token = bytesToHex(randomBytes(32));
    const pendienteId = await ctx.db.insert("registrosPendientes", {
      nombreNegocio: negocio,
      nombreAdmin: persona,
      email: correo,
      passwordHash: hashPassword(password),
      zonaHoraria: zona,
      token,
      expiraEn: ahora + PENDIENTE_MS,
      creadoEn: ahora,
    });
    await encolar(ctx, { tipo: "verificacion_registro", registroPendienteId: pendienteId });
    return { ok: true };
  },
});

/**
 * Estado de un enlace de verificación para la pantalla de confirmación (no consume). Al
 * portador del token (que lo recibió en su buzón) le muestra el negocio/email para pintar la
 * pantalla; a un token inválido/expirado no le revela nada más. Evita consumir el token por
 * prefetch del cliente de correo: el consumo es en `confirmar` (acción del usuario).
 */
export const porToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!TOKEN_RE.test(token)) return { estado: "invalido" as const };
    const pend = await ctx.db.query("registrosPendientes").withIndex("por_token", (q) => q.eq("token", token)).first();
    if (!pend) return { estado: "invalido" as const };
    if (pend.expiraEn <= Date.now()) return { estado: "expirado" as const };
    return { estado: "valido" as const, negocioNombre: pend.nombreNegocio, email: pend.email };
  },
});

/**
 * Confirma el registro: valida el token (existe, no expirado), REVALIDA la unicidad global
 * del email AHORA (pudo ocuparse durante la espera) y crea negocio (activo) + admin (activo,
 * con el hash del pendiente) + sesión, borrando el pendiente — todo en UNA mutación atómica
 * (precisión 4/5). Errores seguros para el portador del token (sin token/hash/email ajeno/
 * datos de tenant). El negocio queda aislado por `negocioId` desde el primer momento.
 */
export const confirmar = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!TOKEN_RE.test(token)) throw new ConvexError("Enlace no válido o ya usado");
    const pend = await ctx.db.query("registrosPendientes").withIndex("por_token", (q) => q.eq("token", token)).first();
    if (!pend) throw new ConvexError("Enlace no válido o ya usado");
    const ahora = Date.now();
    if (pend.expiraEn <= ahora) {
      await ctx.db.delete(pend._id);
      throw new ConvexError("El enlace ha expirado. Vuelve a registrarte.");
    }

    // Revalida unicidad global (misma política de email, normalizado). Si se ocupó durante la
    // espera, no crea nada y consume el pendiente. Mensaje seguro (no revela datos ajenos).
    const correo = pend.email;
    const usuarioExiste = await ctx.db.query("usuarios").withIndex("por_email", (q) => q.eq("email", correo)).first();
    const negocioExiste = await ctx.db.query("negocios").withIndex("por_email_admin", (q) => q.eq("emailAdmin", correo)).first();
    if (usuarioExiste || negocioExiste) {
      await ctx.db.delete(pend._id);
      throw new ConvexError("Ese email ya tiene una cuenta. Inicia sesión o recupera tu contraseña.");
    }

    const negocioId = await ctx.db.insert("negocios", {
      nombre: pend.nombreNegocio,
      emailAdmin: correo,
      zonaHoraria: pend.zonaHoraria,
      estado: "activo",
    });
    const usuarioId = await ctx.db.insert("usuarios", {
      negocioId,
      nombre: pend.nombreAdmin,
      email: correo,
      rol: "admin",
      estado: "activo",
      passwordHash: pend.passwordHash,
      ultimoAcceso: ahora,
    });
    const sesionToken = bytesToHex(randomBytes(32));
    await ctx.db.insert("sesiones", { usuarioId, negocioId, token: sesionToken, expiraEn: ahora + SESION_MS });
    await ctx.db.delete(pend._id); // consumo = borrado (un solo uso)

    return { token: sesionToken, nombre: pend.nombreAdmin, negocio: pend.nombreNegocio };
  },
});

/** Purga los pendientes vencidos (cron). Rango acotado por `por_expira` (obs. B-3), no escaneo. */
export const purgarPendientes = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ borrados: number }> => {
    const ahora = Date.now();
    const lote = await ctx.db.query("registrosPendientes").withIndex("por_expira", (q) => q.lt("expiraEn", ahora)).take(PURGA_LOTE);
    for (const p of lote) await ctx.db.delete(p._id);
    return { borrados: lote.length };
  },
});

// --- Helpers SOLO para pruebas (dev) ---------------------------------------
// Gateados por `QA_HELPERS=1` (solo dev → inertes en prod). NO exponen passwordHash.

/** Lista los pendientes (sin passwordHash ni token) para las aserciones (solo pruebas). */
export const qaListarPendientes = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    const all = (await ctx.db.query("registrosPendientes").collect()).sort((a, b) => b.creadoEn - a.creadoEn);
    return all.map((p) => ({ id: p._id, email: p.email, nombreNegocio: p.nombreNegocio, expiraFuturo: p.expiraEn > Date.now() }));
  },
});

/** Ajusta `creadoEn`/`expiraEn` de un pendiente para ejercer throttle/fusible/purga (solo pruebas). */
export const qaAjustarPendiente = internalMutation({
  args: { id: v.id("registrosPendientes"), creadoEn: v.optional(v.number()), expiraEn: v.optional(v.number()) },
  handler: async (ctx, { id, creadoEn, expiraEn }) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    const patch: Record<string, unknown> = {};
    if (creadoEn !== undefined) patch.creadoEn = creadoEn;
    if (expiraEn !== undefined) patch.expiraEn = expiraEn;
    await ctx.db.patch(id, patch);
  },
});

/** Devuelve el token de un pendiente para probar `confirmar`/`porToken` (solo pruebas, dev). */
export const qaTokenDePendiente = internalMutation({
  args: { id: v.id("registrosPendientes") },
  handler: async (ctx, { id }) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    const p = await ctx.db.get(id);
    return p ? { token: p.token } : null;
  },
});

/** Siembra N pendientes con un `creadoEn` dado (para ejercer el fusible global, solo pruebas). */
export const qaSembrarPendientes = internalMutation({
  args: { n: v.number(), creadoEn: v.number() },
  handler: async (ctx, { n, creadoEn }) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    for (let i = 0; i < n; i++) {
      await ctx.db.insert("registrosPendientes", {
        nombreNegocio: "QA seed",
        nombreAdmin: "QA",
        email: `qa-seed-${creadoEn}-${i}@test.mx`,
        passwordHash: "x:y",
        zonaHoraria: "America/Mexico_City",
        token: `qa-seed-tok-${creadoEn}-${i}`,
        expiraEn: creadoEn + 24 * 60 * 60 * 1000,
        creadoEn,
      });
    }
    return { sembrados: n };
  },
});

/** Borra todos los pendientes (limpieza de residuos QA en dev). */
export const qaPurgarPendientes = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.QA_HELPERS !== "1") throw new Error("QA helpers deshabilitados");
    const all = await ctx.db.query("registrosPendientes").collect();
    for (const p of all) await ctx.db.delete(p._id);
    return { borrados: all.length };
  },
});
