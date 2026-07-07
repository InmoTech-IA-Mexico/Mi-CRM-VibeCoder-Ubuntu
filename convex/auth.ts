import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { scrypt } from "@noble/hashes/scrypt.js";
import { randomBytes, bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

// Autenticación por email + contraseña (JUA-6). Sin registro público (solo
// invitación). Contraseñas con hash scrypt (memoria-dura); nunca texto plano.

const SCRYPT = { N: 2 ** 14, r: 8, p: 1, dkLen: 32 } as const;
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 30 * 60 * 1000; // 30 min de bloqueo tras 5 fallos
const SESION_MS = 8 * 60 * 60 * 1000; // sesión expira a las 8 h (deslizante)

/** Genera "saltHex:hashHex" para una contraseña. Reutilizado por el seed. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scrypt(password, salt, SCRYPT);
  return `${bytesToHex(salt)}:${bytesToHex(hash)}`;
}

function verifyPassword(password: string, almacenado: string): boolean {
  const [saltHex, hashHex] = almacenado.split(":");
  if (!saltHex || !hashHex) return false;
  const esperado = hexToBytes(hashHex);
  const calculado = scrypt(password, hexToBytes(saltHex), SCRYPT);
  if (calculado.length !== esperado.length) return false;
  let diff = 0; // comparación en tiempo constante
  for (let i = 0; i < calculado.length; i++) diff |= calculado[i] ^ esperado[i];
  return diff === 0;
}

// Sal fija para "quemar" un scrypt cuando el email no existe: iguala el tiempo
// de respuesta con el de una cuenta real y evita enumerar usuarios por timing.
const SAL_DUMMY = hexToBytes("00000000000000000000000000000000");

/**
 * Resuelve la sesión a partir del token, usando **el tiempo del servidor**
 * (`Date.now()`), nunca uno enviado por el cliente. Devuelve el usuario y el
 * `negocioId` de la sesión, o `null` si el token no existe, expiró o el usuario
 * está inactivo. Base del aislamiento por negocio (JUA-10): el `negocioId` de
 * toda consulta protegida se obtiene de aquí, jamás del payload del cliente.
 */
export async function resolverSesion(ctx: QueryCtx | MutationCtx, token: string) {
  const sesion = await ctx.db
    .query("sesiones")
    .withIndex("por_token", (q) => q.eq("token", token))
    .first();
  if (!sesion || sesion.expiraEn <= Date.now()) return null;

  const usuario = await ctx.db.get(sesion.usuarioId);
  if (!usuario || usuario.estado === "inactivo") return null;

  return { usuario, negocioId: sesion.negocioId };
}

type ResultadoLogin =
  | { ok: true; token: string }
  | { ok: false; bloqueadoHasta?: number };

/**
 * Inicia sesión. Devuelve error **genérico** (sin revelar si falla el email o
 * la contraseña). Tras 5 fallos consecutivos, bloquea la cuenta 30 min. Un
 * usuario `inactivo` no puede entrar aunque la contraseña sea correcta.
 */
export const iniciarSesion = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }): Promise<ResultadoLogin> => {
    const ahora = Date.now();
    const usuario = await ctx.db
      .query("usuarios")
      .withIndex("por_email", (q) => q.eq("email", email.trim().toLowerCase()))
      .first();

    // Sin usuario o sin contraseña configurada → error genérico. Quemamos un
    // scrypt para igualar el tiempo de respuesta (anti-enumeración por timing).
    if (!usuario || !usuario.passwordHash) {
      scrypt(password, SAL_DUMMY, SCRYPT);
      return { ok: false };
    }

    // Cuenta bloqueada: devolver el tiempo restante.
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
      return { ok: false, bloqueadoHasta: usuario.bloqueadoHasta };
    }

    // Usuario inactivo → no entra (genérico, para no filtrar el estado).
    if (usuario.estado === "inactivo") return { ok: false };

    if (!verifyPassword(password, usuario.passwordHash)) {
      const intentos = (usuario.intentosFallidos ?? 0) + 1;
      if (intentos >= MAX_INTENTOS) {
        const bloqueadoHasta = ahora + BLOQUEO_MS;
        await ctx.db.patch(usuario._id, { intentosFallidos: 0, bloqueadoHasta });
        return { ok: false, bloqueadoHasta };
      }
      await ctx.db.patch(usuario._id, { intentosFallidos: intentos });
      return { ok: false };
    }

    // Correcto: resetear intentos y crear la sesión (token opaco).
    await ctx.db.patch(usuario._id, {
      intentosFallidos: 0,
      bloqueadoHasta: undefined,
      ultimoAcceso: ahora,
    });
    const token = bytesToHex(randomBytes(32));
    await ctx.db.insert("sesiones", {
      usuarioId: usuario._id,
      negocioId: usuario.negocioId,
      token,
      expiraEn: ahora + SESION_MS,
    });
    return { ok: true, token };
  },
});

/** Sesión del token actual (o null si no existe / expiró / usuario inactivo). */
export const sesionActual = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return null;

    const { usuario } = sesion;
    const negocio = await ctx.db.get(sesion.negocioId);
    if (!negocio) return null;

    // Nunca exponer el hash de contraseña al cliente.
    return {
      usuario: {
        _id: usuario._id,
        negocioId: usuario.negocioId,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        estado: usuario.estado,
      },
      negocio,
      rol: usuario.rol,
    };
  },
});

/** Extiende la sesión 8 h más (expiración deslizante por inactividad). */
export const tocarSesion = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const ahora = Date.now();
    const sesion = await ctx.db
      .query("sesiones")
      .withIndex("por_token", (q) => q.eq("token", token))
      .first();
    if (!sesion || sesion.expiraEn <= ahora) return;
    await ctx.db.patch(sesion._id, { expiraEn: ahora + SESION_MS });
  },
});

/** Cierra la sesión (borra el token). */
export const cerrarSesion = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await ctx.db
      .query("sesiones")
      .withIndex("por_token", (q) => q.eq("token", token))
      .first();
    if (sesion) await ctx.db.delete(sesion._id);
  },
});
