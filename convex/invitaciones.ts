import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { hashPassword } from "./auth";

// Activación de cuenta desde una invitación (JUA-8 admin / JUA-9 operativo).
// Funciones PÚBLICAS: el invitado aún no tiene sesión; se autentica con el token
// de la invitación. Al activar se crea el usuario, se marca la invitación como
// aceptada y se devuelve una sesión para entrar directo al CRM.

const SESION_MS = 8 * 60 * 60 * 1000; // igual que auth.ts (sesión 8 h)

/**
 * Estado de una invitación para la pantalla de activación. No expone el token ni
 * datos sensibles: solo lo necesario para pintar el formulario.
 */
export const porToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const inv = await ctx.db
      .query("invitaciones")
      .withIndex("por_token", (q) => q.eq("token", token))
      .first();
    if (!inv) return { estado: "invalida" as const };
    if (inv.estado === "aceptada") return { estado: "aceptada" as const };
    if (inv.estado === "expirada" || inv.expiraEn <= Date.now()) return { estado: "expirada" as const };

    const negocio = await ctx.db.get(inv.negocioId);
    return {
      estado: "pendiente" as const,
      email: inv.email,
      nombre: inv.nombre ?? null,
      rol: inv.rol,
      requiereZona: inv.rol === "admin", // la zona horaria solo se pide al admin (JUA-8)
      negocioNombre: negocio?.nombre ?? null,
    };
  },
});

/**
 * Activa la cuenta: fija la contraseña (y, si es admin, la zona horaria del
 * negocio), crea el usuario activo, marca la invitación aceptada y devuelve una
 * sesión. Email globalmente único. Rechaza enlaces expirados o ya usados.
 */
export const activar = mutation({
  args: {
    token: v.string(),
    password: v.string(),
    zonaHoraria: v.optional(v.string()),
    negocioNombre: v.optional(v.string()),
  },
  handler: async (ctx, { token, password, zonaHoraria, negocioNombre }) => {
    const inv = await ctx.db
      .query("invitaciones")
      .withIndex("por_token", (q) => q.eq("token", token))
      .first();
    if (!inv) throw new Error("Invitación no válida");
    if (inv.estado === "aceptada") throw new Error("Esta invitación ya fue aceptada");
    const ahora = Date.now();
    if (inv.estado === "expirada" || inv.expiraEn <= ahora) throw new Error("El enlace ha expirado");
    if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

    // Email globalmente único (un email = un usuario en toda la app).
    const existente = await ctx.db
      .query("usuarios")
      .withIndex("por_email", (q) => q.eq("email", inv.email))
      .first();
    if (existente) throw new Error("Ya existe una cuenta con ese email");

    // Datos del negocio al activar la cuenta admin (JUA-8): zona horaria
    // (obligatoria) y, opcionalmente, el nombre del negocio.
    if (inv.rol === "admin") {
      if (!zonaHoraria) throw new Error("Selecciona la zona horaria del negocio");
      const nombreNegocio = negocioNombre?.trim();
      await ctx.db.patch(inv.negocioId, {
        zonaHoraria,
        ...(nombreNegocio ? { nombre: nombreNegocio } : {}),
      });
    }

    const nombre = inv.nombre?.trim() || inv.email.split("@")[0];
    const usuarioId = await ctx.db.insert("usuarios", {
      negocioId: inv.negocioId,
      nombre,
      email: inv.email,
      rol: inv.rol,
      estado: "activo",
      passwordHash: hashPassword(password),
      ultimoAcceso: ahora,
    });

    await ctx.db.patch(inv._id, { estado: "aceptada" });

    // Sesión para entrar directo (sin pasar por Login). Se devuelve el nombre
    // (con el fallback ya aplicado) para la pantalla de bienvenida.
    const sesionToken = bytesToHex(randomBytes(32));
    await ctx.db.insert("sesiones", {
      usuarioId,
      negocioId: inv.negocioId,
      token: sesionToken,
      expiraEn: ahora + SESION_MS,
    });
    return { token: sesionToken, nombre };
  },
});
