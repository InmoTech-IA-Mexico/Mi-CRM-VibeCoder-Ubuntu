import { mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { hashPassword } from "./auth";
import { validarNombre, validarZona, validarEmailAdminLibre } from "./negocios";

// Registro público autoservicio de nuevos negocios (JUA-39). Función PÚBLICA (sin
// sesión): cualquiera crea su negocio + su cuenta de administrador en un paso y
// entra directo. Aislamiento por diseño (negocio nuevo = tenant nuevo, sin acceso
// a otros negocios). Anti-abuso al nivel del proyecto (que no usa IP ni CAPTCHA):
// unicidad global del email + un tope GLOBAL de registros por ventana. La
// VERIFICACIÓN DE EMAIL queda pendiente del envío por Resend (criterio JUA-39:
// "activa y lista para usar inmediatamente O tras verificar email").

const SESION_MS = 8 * 60 * 60 * 1000; // igual que auth/invitaciones (8 h)
const NOMBRE_PERSONA_MAX = 80;
const PASSWORD_MIN = 8;
// Tope global anti-abuso: como máximo MAX_REGISTROS negocios nuevos por VENTANA_MS.
const MAX_REGISTROS = 5;
const VENTANA_MS = 60 * 1000;

/**
 * Registra un negocio nuevo y su administrador en un paso y devuelve una sesión
 * para entrar directo (JUA-39). Sin sesión previa. Valida el nombre del negocio,
 * el nombre de la persona, el email (unicidad global), la contraseña (≥8) y la
 * zona (IANA). Aplica un throttle global anti-abuso. El negocio queda `activo` y
 * aislado desde el primer momento.
 */
export const registrarNegocio = mutation({
  args: {
    nombreNegocio: v.string(),
    nombreAdmin: v.string(),
    email: v.string(),
    password: v.string(),
    zonaHoraria: v.string(),
  },
  handler: async (ctx, { nombreNegocio, nombreAdmin, email, password, zonaHoraria }) => {
    const negocio = validarNombre(nombreNegocio);
    const persona = nombreAdmin.trim();
    if (!persona) throw new ConvexError("Tu nombre es obligatorio");
    if (persona.length > NOMBRE_PERSONA_MAX) throw new ConvexError("El nombre es demasiado largo");
    if (password.length < PASSWORD_MIN) throw new ConvexError("La contraseña debe tener al menos 8 caracteres");
    const zona = validarZona(zonaHoraria);

    // Throttle GLOBAL anti-abuso: no más de MAX_REGISTROS negocios por VENTANA_MS.
    const ahora = Date.now();
    const recientes = await ctx.db.query("negocios").order("desc").take(MAX_REGISTROS);
    if (recientes.length === MAX_REGISTROS && recientes[MAX_REGISTROS - 1]._creationTime > ahora - VENTANA_MS) {
      throw new ConvexError("Hay demasiados registros en este momento. Inténtalo de nuevo en un minuto.");
    }

    // Unicidad global (un email = un usuario; un emailAdmin = un negocio) + aislamiento.
    const correo = await validarEmailAdminLibre(ctx, email);

    const negocioId = await ctx.db.insert("negocios", {
      nombre: negocio,
      emailAdmin: correo,
      zonaHoraria: zona,
      estado: "activo",
    });
    const usuarioId = await ctx.db.insert("usuarios", {
      negocioId,
      nombre: persona,
      email: correo,
      rol: "admin",
      estado: "activo",
      passwordHash: hashPassword(password),
      ultimoAcceso: ahora,
    });

    // Sesión para entrar directo (sin pasar por Login), como `invitaciones.activar`.
    const token = bytesToHex(randomBytes(32));
    await ctx.db.insert("sesiones", { usuarioId, negocioId, token, expiraEn: ahora + SESION_MS });
    return { token, nombre: persona, negocio };
  },
});
