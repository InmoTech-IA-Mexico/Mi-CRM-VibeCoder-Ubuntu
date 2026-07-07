import { query } from "./_generated/server";

// Sesión del usuario actual.
//
// TODO(JUA-6/JUA-30): mientras no exista autenticación real, la "sesión" se
// resuelve tomando el primer negocio y la lista de sus usuarios. El cliente
// elige cuál está activo (localStorage). Sustituir por `ctx.auth` cuando exista
// el login (JUA-6) y el sistema de permisos (JUA-30).
export const actual = query({
  args: {},
  handler: async (ctx) => {
    const negocio = await ctx.db.query("negocios").first();
    if (!negocio) return null;

    const usuarios = await ctx.db
      .query("usuarios")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocio._id))
      .collect();

    return { negocio, usuarios };
  },
});
