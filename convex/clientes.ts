import { query } from "./_generated/server";
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
