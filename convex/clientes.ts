import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { resolverSesion, resolverSesionEscritura } from "./auth";
import { MS_DIA, recordatorioProximoIds, debeMarcarseInactivo } from "./inactividad";

const DIAS_PAPELERA = 30; // días en papelera antes del borrado definitivo (JUA-16)

// Cartera por vendedor (JUA-43): el rol **operativo** solo ve/gestiona los
// clientes de los que es responsable. El admin ve todos (con toggle "solo míos")
// y el observador (lectura global del negocio, JUA-42) también ve todos.
export type SesionResuelta = { usuario: Doc<"usuarios">; negocioId: Id<"negocios"> };
export function esDeCartera(cliente: Doc<"clientes">, sesion: SesionResuelta): boolean {
  return sesion.usuario.rol !== "operativo" || cliente.responsableId === sesion.usuario._id;
}
/** Lanza "No encontrado" si un operativo intenta tocar un cliente que no es suyo. */
export function verificarCartera(sesion: SesionResuelta, cliente: Doc<"clientes">) {
  if (!esDeCartera(cliente, sesion)) throw new Error("No encontrado");
}

// Lista de clientes del negocio (JUA-14). Devuelve todos (excepto papelera) con
// los campos para el buscador en tiempo real (nombre/teléfono/email/empresa) y la
// etapa de la oportunidad abierta más reciente. El filtrado por texto se hace en
// el cliente (instantáneo, sin round-trip por tecla). El `negocioId` sale de la
// sesión (JUA-10), nunca del payload del cliente.
const ETAPAS_CERRADAS = ["ganada", "perdida", "cancelada"];

export const listar = query({
  // `soloMios` (JUA-43): el admin puede togglear entre su cartera y todos. Para
  // el operativo se ignora (siempre ve solo la suya).
  args: { token: v.string(), soloMios: v.optional(v.boolean()) },
  handler: async (ctx, { token, soloMios }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return [];
    const negocioId = sesion.negocioId;

    const clientes = await ctx.db
      .query("clientes")
      .withIndex("por_negocio", (q) => q.eq("negocioId", negocioId))
      .collect();

    const soloDeMiCartera = sesion.usuario.rol === "operativo" || (sesion.usuario.rol === "admin" && soloMios);
    const rows = await Promise.all(
      clientes
        .filter((c) => c.eliminadoEn == null)
        // Cartera (JUA-43): operativo → solo suyos; admin → todos o solo suyos.
        .filter((c) => !soloDeMiCartera || c.responsableId === sesion.usuario._id)
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
            // Etiquetas de producto (JUA-36): ids para el filtro de la lista.
            etiquetaIds: c.etiquetaIds ?? [],
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

// Estados a los que el usuario puede pasar el cliente MANUALMENTE (JUA-13).
// `nuevo` e `inactivo` tienen reglas automáticas y no se fijan a mano.
const ESTADOS_MANUALES = ["prospecto", "activo", "descartado"] as const;

/**
 * Ficha completa de un cliente (JUA-13). Devuelve sus datos, las oportunidades
 * y los seguimientos pendientes. Valida pertenencia al negocio de la sesión
 * (JUA-10): un cliente de otro negocio, inexistente o en papelera → `null`
 * (el cliente muestra "no encontrado", sin revelar si existe).
 */
export const detalle = query({
  // `clienteId` llega de la URL, así que puede venir malformado: se acepta como
  // string y se normaliza (id inválido → null → "no encontrado"), evitando un
  // error de validación y sin revelar si existe (JUA-10).
  args: { token: v.string(), clienteId: v.string() },
  handler: async (ctx, { token, clienteId }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return null;

    const id = ctx.db.normalizeId("clientes", clienteId);
    if (!id) return null;
    const c = await ctx.db.get(id);
    if (!c || c.negocioId !== sesion.negocioId || c.eliminadoEn != null) return null;
    // Cartera (JUA-43): un operativo no ve fichas fuera de su cartera (null =
    // "no encontrado", sin revelar que existe).
    if (!esDeCartera(c, sesion)) return null;

    const opos = await ctx.db
      .query("oportunidades")
      .withIndex("por_cliente", (q) => q.eq("clienteId", id))
      .order("desc")
      .collect();

    const seguimientos = await ctx.db
      .query("seguimientos")
      .withIndex("por_cliente", (q) => q.eq("clienteId", id))
      .collect();
    const pendientes = seguimientos
      .filter((s) => s.estado === "pendiente")
      .sort((a, b) => a.fecha - b.fecha);

    // Historial de notas (JUA-18): orden cronológico inverso, con el autor.
    const notasRaw = await ctx.db
      .query("notas")
      .withIndex("por_cliente", (q) => q.eq("clienteId", id))
      .collect();
    const usuarios = await ctx.db
      .query("usuarios")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    const nombrePorId = new Map(usuarios.map((u) => [u._id, u.nombre]));

    // Ventas del cliente (JUA-110): aparecen en el historial. El cliente ya está
    // validado por sesión; se filtra también por negocio como defensa extra.
    const ventasRaw = (
      await ctx.db
        .query("ventas")
        .withIndex("por_cliente", (q) => q.eq("clienteId", id))
        .collect()
    ).filter((vt) => vt.negocioId === sesion.negocioId);
    const nombreOpoPorId = new Map(opos.map((o) => [o._id, o.nombre]));

    // Etiquetas de producto asignadas (JUA-36), resueltas a nombre. Si alguna
    // fue eliminada del catálogo se omite (la limpieza vive en etiquetas.eliminar).
    const etiquetas = (
      await Promise.all((c.etiquetaIds ?? []).map((eid) => ctx.db.get(eid)))
    )
      .filter((e) => e != null && e.negocioId === sesion.negocioId)
      .map((e) => ({ _id: e!._id, nombre: e!.nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return {
      _id: c._id,
      nombre: c.nombre,
      tipo: c.tipo ?? null,
      telefono: c.telefono ?? null,
      email: c.email ?? null,
      empresa: c.empresa ?? null,
      cargo: c.cargo ?? null,
      direccion: c.direccion ?? null,
      canal: c.canal ?? null,
      estado: c.estado,
      prioridad: c.prioridad ?? null,
      etiquetas,
      // Responsable de la cartera (JUA-43): nombre resuelto, o null si sin asignar.
      responsable: c.responsableId
        ? { _id: c.responsableId, nombre: nombrePorId.get(c.responsableId) ?? "—" }
        : null,
      observaciones: c.observaciones ?? null,
      ultimaInteraccion: c.ultimaInteraccion ?? null,
      creadoEn: c._creationTime,
      oportunidades: opos.map((o) => ({
        _id: o._id,
        nombre: o.nombre,
        etapa: o.etapa,
        monto: o.monto ?? null,
        fechaCierre: o.fechaCierre ?? null,
      })),
      seguimientos: pendientes.map((s) => ({
        _id: s._id,
        titulo: s.titulo,
        fecha: s.fecha,
        hora: s.hora ?? null,
        prioridad: s.prioridad,
        responsableId: s.responsableId,
        frecuencia: s.frecuencia,
      })),
      notas: notasRaw
        .sort((a, b) => b.fecha - a.fecha)
        .map((n) => ({
          _id: n._id,
          tipo: n.tipo,
          descripcion: n.descripcion,
          resultado: n.resultado ?? null,
          fecha: n.fecha,
          autorNombre: nombrePorId.get(n.autorId) ?? "—",
        })),
      ventas: ventasRaw
        .sort((a, b) => b.fecha - a.fecha)
        .map((vt) => ({
          _id: vt._id,
          importe: vt.importe,
          fecha: vt.fecha,
          oportunidadNombre: vt.oportunidadId ? (nombreOpoPorId.get(vt.oportunidadId) ?? null) : null,
          registradoPorNombre: nombrePorId.get(vt.registradoPorId) ?? "—",
        })),
    };
  },
});

/** Cambia el estado del cliente manualmente (JUA-13). Valida pertenencia. */
export const cambiarEstado = mutation({
  args: {
    token: v.string(),
    clienteId: v.id("clientes"),
    estado: v.union(v.literal("prospecto"), v.literal("activo"), v.literal("descartado")),
  },
  handler: async (ctx, { token, clienteId, estado }) => {
    const sesion = await resolverSesionEscritura(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const c = await ctx.db.get(clienteId);
    if (!c || c.negocioId !== sesion.negocioId || c.eliminadoEn != null) {
      throw new Error("No encontrado");
    }
    verificarCartera(sesion, c); // operativo: solo su cartera (JUA-43)
    if (!ESTADOS_MANUALES.includes(estado)) throw new Error("Estado no permitido");

    await ctx.db.patch(clienteId, { estado, actualizadoEn: Date.now() });
  },
});

/**
 * Cambia la prioridad estratégica del cliente (JUA-46): alta / media / baja, o
 * `null` para dejarlo "sin prioridad". Es un campo del cliente distinto de la
 * prioridad de un seguimiento (esa indica urgencia de una tarea). Ambos roles
 * pueden editarla. Actualiza `actualizadoEn`. Valida pertenencia al negocio (JUA-10).
 */
export const cambiarPrioridad = mutation({
  args: {
    token: v.string(),
    clienteId: v.id("clientes"),
    prioridad: v.union(v.literal("alta"), v.literal("media"), v.literal("baja"), v.null()),
  },
  handler: async (ctx, { token, clienteId, prioridad }) => {
    const sesion = await resolverSesionEscritura(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const c = await ctx.db.get(clienteId);
    if (!c || c.negocioId !== sesion.negocioId || c.eliminadoEn != null) {
      throw new Error("No encontrado");
    }
    verificarCartera(sesion, c); // operativo: solo su cartera (JUA-43)

    await ctx.db.patch(clienteId, { prioridad: prioridad ?? undefined, actualizadoEn: Date.now() });
  },
});

/**
 * Asigna las etiquetas de producto del cliente (JUA-36). Ambos roles (como la
 * prioridad). Reemplaza el conjunto completo; valida que cada etiqueta exista y
 * sea del negocio de la sesión. No cuenta como interacción.
 */
export const cambiarEtiquetas = mutation({
  args: {
    token: v.string(),
    clienteId: v.id("clientes"),
    etiquetaIds: v.array(v.id("etiquetas")),
  },
  handler: async (ctx, { token, clienteId, etiquetaIds }) => {
    const sesion = await resolverSesionEscritura(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const c = await ctx.db.get(clienteId);
    if (!c || c.negocioId !== sesion.negocioId || c.eliminadoEn != null) {
      throw new Error("No encontrado");
    }
    verificarCartera(sesion, c); // operativo: solo su cartera (JUA-43)

    const unicas = [...new Set(etiquetaIds)];
    for (const eid of unicas) {
      const e = await ctx.db.get(eid);
      if (!e || e.negocioId !== sesion.negocioId) throw new Error("Etiqueta no válida");
    }

    await ctx.db.patch(clienteId, {
      etiquetaIds: unicas.length > 0 ? unicas : undefined,
      actualizadoEn: Date.now(),
    });
  },
});

/**
 * Asigna (o reasigna / desasigna) el responsable de la cartera de un cliente
 * (JUA-43). Solo admin. `responsableId = null` deja el cliente en el pool "sin
 * asignar" (solo visible para el admin). El nuevo responsable debe ser del
 * negocio, activo y NO observador (el observador es solo lectura, no tiene
 * cartera). No cuenta como interacción.
 *
 * Migración de seguimientos SOLO en el traspaso ENTRE responsables (JUA-43,
 * obs. OBS-1): al reasignar de un dueño a otro, los seguimientos de cliente
 * pendientes que eran del dueño anterior pasan al nuevo, para que no queden
 * "huérfanos". No se tocan los que un admin delegó a un tercero (responsable ≠
 * dueño anterior). Deliberadamente NO se migra al sacar un cliente del pool
 * "sin asignar" (no había dueño anterior): esos seguimientos los creó y los
 * gestiona el admin, que puede re-delegarlos si procede.
 */
export const asignarResponsable = mutation({
  args: {
    token: v.string(),
    clienteId: v.id("clientes"),
    responsableId: v.union(v.id("usuarios"), v.null()),
  },
  handler: async (ctx, { token, clienteId, responsableId }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion || sesion.usuario.rol !== "admin") throw new Error("No autorizado");

    const c = await ctx.db.get(clienteId);
    if (!c || c.negocioId !== sesion.negocioId || c.eliminadoEn != null) {
      throw new Error("No encontrado");
    }

    if (responsableId) {
      const resp = await ctx.db.get(responsableId);
      if (!resp || resp.negocioId !== sesion.negocioId || resp.estado !== "activo" || resp.rol === "observador") {
        throw new Error("Responsable no válido");
      }
    }

    const anterior = c.responsableId;
    await ctx.db.patch(clienteId, {
      responsableId: responsableId ?? undefined,
      actualizadoEn: Date.now(),
    });

    // Traspaso entre responsables: los seguimientos de cliente PENDIENTES del
    // dueño anterior pasan al nuevo (JUA-43, obs. OBS-1). El caso "pool → dueño"
    // (sin dueño anterior) no migra a propósito: esos los gestiona el admin.
    if (responsableId && anterior && responsableId !== anterior) {
      const seguimientos = await ctx.db
        .query("seguimientos")
        .withIndex("por_cliente", (q) => q.eq("clienteId", clienteId))
        .collect();
      for (const s of seguimientos) {
        if (s.destino === "cliente" && s.estado === "pendiente" && s.responsableId === anterior) {
          await ctx.db.patch(s._id, { responsableId });
        }
      }
    }
  },
});

/**
 * Envía el cliente a la papelera (soft delete). Solo Marta (admin) puede
 * eliminar clientes (JUA-13). Valida pertenencia al negocio de la sesión.
 */
export const enviarAPapelera = mutation({
  args: { token: v.string(), clienteId: v.id("clientes") },
  handler: async (ctx, { token, clienteId }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) throw new Error("No autorizado");
    if (sesion.usuario.rol !== "admin") throw new Error("Solo el administrador puede eliminar clientes");

    const c = await ctx.db.get(clienteId);
    if (!c || c.negocioId !== sesion.negocioId || c.eliminadoEn != null) {
      throw new Error("No encontrado");
    }

    const ahora = Date.now();
    await ctx.db.patch(clienteId, { eliminadoEn: ahora, actualizadoEn: ahora });
  },
});

// Normalización para comparar duplicados: teléfono solo dígitos, email en
// minúsculas. Un mismo contacto escrito distinto ("55 1234" vs "551234") coincide.
const soloDigitos = (s: string) => s.replace(/\D/g, "");
const normalizarEmail = (s: string) => s.trim().toLowerCase();

/**
 * Busca un cliente del negocio con el mismo teléfono o email (JUA-12). Sirve
 * para avisar de duplicados **antes** de guardar (avisa, no bloquea). Deriva el
 * negocio de la sesión (JUA-10). Devuelve el primer coincidente o null.
 */
export const buscarDuplicado = query({
  args: { token: v.string(), telefono: v.string(), email: v.string() },
  handler: async (ctx, { token, telefono, email }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion) return null;

    const tel = soloDigitos(telefono);
    const mail = normalizarEmail(email);
    if (!tel && !mail) return null;

    const clientes = await ctx.db
      .query("clientes")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();

    const match = clientes.find(
      (c) =>
        c.eliminadoEn == null &&
        // Cartera (JUA-43): un operativo solo detecta duplicados de SU cartera; no
        // se le revelan datos de clientes de otro vendedor.
        esDeCartera(c, sesion) &&
        ((tel && c.telefono && soloDigitos(c.telefono) === tel) ||
          (mail && c.email && normalizarEmail(c.email) === mail)),
    );
    if (!match) return null;
    const porTelefono = !!(tel && match.telefono && soloDigitos(match.telefono) === tel);
    return {
      _id: match._id,
      nombre: match.nombre,
      telefono: match.telefono ?? null,
      email: match.email ?? null,
      campo: porTelefono ? ("telefono" as const) : ("email" as const),
    };
  },
});

/**
 * Alta rápida de cliente (JUA-12). Requiere nombre + al menos teléfono o email.
 * Estado inicial "nuevo" (automático), responsable = quien lo crea, negocio de
 * la sesión (JUA-10). Devuelve el id para abrir su ficha. No bloquea por
 * duplicados (el aviso es en la UI).
 */
export const crear = mutation({
  args: {
    token: v.string(),
    nombre: v.string(),
    telefono: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { token, nombre, telefono, email }) => {
    const sesion = await resolverSesionEscritura(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const nombreLimpio = nombre.trim();
    const telLimpio = telefono.trim();
    const emailLimpio = email.trim();
    if (!nombreLimpio) throw new Error("El nombre es obligatorio");
    if (!telLimpio && !emailLimpio) throw new Error("Indica al menos un teléfono o email");

    const ahora = Date.now();
    return await ctx.db.insert("clientes", {
      negocioId: sesion.negocioId,
      nombre: nombreLimpio,
      telefono: telLimpio || undefined,
      email: emailLimpio || undefined,
      estado: "nuevo",
      responsableId: sesion.usuario._id,
      actualizadoEn: ahora,
    });
  },
});

const CANAL_V = v.union(
  v.literal("whatsapp"),
  v.literal("email"),
  v.literal("web"),
  v.literal("telefono"),
  v.literal("referido"),
  v.literal("redes"),
);
const PRIORIDAD_V = v.union(v.literal("alta"), v.literal("media"), v.literal("baja"));

/**
 * Edita los datos de un cliente (JUA-67). Reutiliza los campos del alta y añade
 * empresa/canal/prioridad. Mantiene la regla nombre + al menos teléfono o email.
 * Valida pertenencia al negocio de la sesión (JUA-10) y actualiza `actualizadoEn`.
 * Estado y papelera se gestionan desde la ficha; aquí no se tocan.
 */
export const actualizar = mutation({
  args: {
    token: v.string(),
    clienteId: v.id("clientes"),
    nombre: v.string(),
    telefono: v.string(),
    email: v.string(),
    empresa: v.string(),
    canal: v.optional(CANAL_V),
    prioridad: PRIORIDAD_V,
  },
  handler: async (ctx, { token, clienteId, nombre, telefono, email, empresa, canal, prioridad }) => {
    const sesion = await resolverSesionEscritura(ctx, token);
    if (!sesion) throw new Error("No autorizado");

    const c = await ctx.db.get(clienteId);
    if (!c || c.negocioId !== sesion.negocioId || c.eliminadoEn != null) {
      throw new Error("No encontrado");
    }
    verificarCartera(sesion, c); // operativo: solo su cartera (JUA-43)

    const nombreLimpio = nombre.trim();
    const telLimpio = telefono.trim();
    const emailLimpio = email.trim();
    if (!nombreLimpio) throw new Error("El nombre es obligatorio");
    if (!telLimpio && !emailLimpio) throw new Error("Indica al menos un teléfono o email");

    await ctx.db.patch(clienteId, {
      nombre: nombreLimpio,
      telefono: telLimpio || undefined,
      email: emailLimpio || undefined,
      empresa: empresa.trim() || undefined,
      canal: canal ?? undefined,
      prioridad,
      actualizadoEn: Date.now(),
    });
  },
});

// ===================== Papelera (JUA-16, solo admin) =====================

/** Borra definitivamente un cliente y todo lo que cuelga de él (no reversible). */
async function borrarClienteYRelacionados(ctx: MutationCtx, clienteId: Id<"clientes">) {
  for (const tabla of ["notas", "oportunidades", "seguimientos", "ventas"] as const) {
    const docs = await ctx.db
      .query(tabla)
      .withIndex("por_cliente", (q) => q.eq("clienteId", clienteId))
      .collect();
    for (const d of docs) await ctx.db.delete(d._id);
  }
  await ctx.db.delete(clienteId);
}

/** Clientes en papelera del negocio (JUA-16). Solo admin; si no, lista vacía. */
export const papelera = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion || sesion.usuario.rol !== "admin") return [];

    const ahora = Date.now();
    const clientes = await ctx.db
      .query("clientes")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();

    return clientes
      .filter((c) => c.eliminadoEn != null)
      .sort((a, b) => b.eliminadoEn! - a.eliminadoEn!)
      .map((c) => {
        const diasEliminado = Math.floor((ahora - c.eliminadoEn!) / MS_DIA);
        return {
          _id: c._id,
          nombre: c.nombre,
          empresa: c.empresa ?? null,
          eliminadoEn: c.eliminadoEn!,
          diasEliminado,
          diasRestantes: Math.max(0, DIAS_PAPELERA - diasEliminado),
        };
      });
  },
});

/** Restaura un cliente de la papelera (JUA-16). Sus datos relacionados nunca se
 *  borraron, así que vuelve intacto. Solo admin; valida pertenencia. */
export const restaurar = mutation({
  args: { token: v.string(), clienteId: v.id("clientes") },
  handler: async (ctx, { token, clienteId }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion || sesion.usuario.rol !== "admin") throw new Error("No autorizado");

    const c = await ctx.db.get(clienteId);
    if (!c || c.negocioId !== sesion.negocioId || c.eliminadoEn == null) {
      throw new Error("No encontrado");
    }
    await ctx.db.patch(clienteId, { eliminadoEn: undefined, actualizadoEn: Date.now() });
  },
});

/** Borra definitivamente un cliente de la papelera (JUA-16). Solo admin. */
export const eliminarDefinitivo = mutation({
  args: { token: v.string(), clienteId: v.id("clientes") },
  handler: async (ctx, { token, clienteId }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion || sesion.usuario.rol !== "admin") throw new Error("No autorizado");

    const c = await ctx.db.get(clienteId);
    if (!c || c.negocioId !== sesion.negocioId || c.eliminadoEn == null) {
      throw new Error("No encontrado");
    }
    await borrarClienteYRelacionados(ctx, clienteId);
  },
});

/** Vacía la papelera del negocio (borra definitivamente todo). Solo admin. */
export const vaciarPapelera = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion || sesion.usuario.rol !== "admin") throw new Error("No autorizado");

    const clientes = await ctx.db
      .query("clientes")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    for (const c of clientes.filter((c) => c.eliminadoEn != null)) {
      await borrarClienteYRelacionados(ctx, c._id);
    }
  },
});

// ---- Inactividad automática (JUA-26) --------------------------------------

/**
 * Aplica la transición a Inactivo a un conjunto de clientes usando la MISMA regla
 * que el panel (JUA-25) y el estado global (JUA-35): 15+ días sin interacción y
 * SIN recordatorio próximo planificado (los `seguimientos` del ámbito permiten
 * calcular esa exclusión, `debeMarcarseInactivo`). Devuelve cuántos cambiaron.
 */
async function transicionarClientes(
  ctx: MutationCtx,
  clientes: Doc<"clientes">[],
  seguimientos: Doc<"seguimientos">[],
  ahora: number,
) {
  const conRecordatorioProximo = recordatorioProximoIds(seguimientos, ahora);
  let cambiados = 0;
  for (const c of clientes) {
    if (debeMarcarseInactivo(c, ahora, conRecordatorioProximo)) {
      await ctx.db.patch(c._id, { estado: "inactivo", actualizadoEn: ahora });
      cambiados++;
    }
  }
  return cambiados;
}

/**
 * Transición automática a Inactivo para TODO el sistema (JUA-26). La ejecuta el
 * cron diario (ver convex/crons.ts) como red de seguridad para negocios en los que
 * nadie abre Inicio. Interna. Inactivo es el único estado que el sistema asigna
 * automáticamente; el resto requiere acción del usuario.
 */
export const transicionarInactivos = internalMutation({
  args: {},
  handler: async (ctx) => {
    const ahora = Date.now();
    const clientes = await ctx.db.query("clientes").collect();
    const seguimientos = await ctx.db.query("seguimientos").collect();
    const cambiados = await transicionarClientes(ctx, clientes, seguimientos, ahora);
    return { cambiados };
  },
});

/**
 * Sincroniza la inactividad del negocio de la sesión (JUA-26). La llama la pantalla
 * de Inicio al cargar para que la transición sea inmediata (complementa al cron
 * diario). Idempotente: no escribe si no hay clientes que transicionar. El negocio
 * sale de la sesión (JUA-10). ESCRIBE (cambia clientes a inactivo), así que el
 * observador (solo lectura, JUA-42) no puede invocarla — el cron diario mantiene
 * la transición para él. La autorización se impone aquí, no en la UI (obs. B-1).
 */
export const sincronizarInactividad = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesionEscritura(ctx, token);
    if (!sesion) return { cambiados: 0 };
    const ahora = Date.now();
    const clientes = await ctx.db
      .query("clientes")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    const seguimientos = await ctx.db
      .query("seguimientos")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    // Cartera (JUA-43): un operativo solo transiciona SUS clientes; jamás toca los
    // de otro vendedor. La transición global del negocio la garantiza el cron.
    const deMiCartera = clientes.filter((c) => esDeCartera(c, sesion));
    const cambiados = await transicionarClientes(ctx, deMiCartera, seguimientos, ahora);
    return { cambiados };
  },
});

/**
 * Purga automática (JUA-16): borra definitivamente los clientes con más de 30
 * días en papelera. La ejecuta el cron diario (ver convex/crons.ts). Interna.
 */
export const purgarPapelera = internalMutation({
  args: {},
  handler: async (ctx) => {
    const limite = Date.now() - DIAS_PAPELERA * MS_DIA;
    const clientes = await ctx.db.query("clientes").collect();
    let purgados = 0;
    for (const c of clientes) {
      if (c.eliminadoEn != null && c.eliminadoEn <= limite) {
        await borrarClienteYRelacionados(ctx, c._id);
        purgados++;
      }
    }
    return { purgados };
  },
});
