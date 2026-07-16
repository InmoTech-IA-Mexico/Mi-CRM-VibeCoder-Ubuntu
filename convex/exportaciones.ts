import { mutation, query, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { resolverSesion } from "./auth";
import { partesLocales } from "./fechas";
import { LABELS } from "./enumsServidor";
import { csv } from "./csv";

// Exportación de datos en autoservicio (JUA-44). Solo el admin puede solicitar
// una exportación: genera un enlace temporal (token único, 24 h, UN SOLO USO).
// Los CSV NO se almacenan en el servidor — se generan al consumir el enlace y se
// devuelven al cliente, que los descarga. La fila de metadatos se purga por cron.
// La serialización segura (escape RFC 4180 + neutralización de fórmula) vive en
// `./csv` (unitariamente comprobable).

const EXPORT_MS = 24 * 60 * 60 * 1000; // 24 h

/** Fecha/hora local del negocio "YYYY-MM-DD HH:MM" (o vacío). */
function fechaLocal(epoch: number | undefined | null, tz: string): string {
  if (epoch == null) return "";
  const p = partesLocales(epoch, tz);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${p.anio}-${dos(p.mes)}-${dos(p.dia)} ${dos(p.hora)}:${dos(p.minuto)}`;
}

/**
 * Solicita una exportación (JUA-44). Solo admin. Invalida las exportaciones
 * previas sin usar del negocio y crea un enlace temporal (24 h, un solo uso).
 * Devuelve el token para construir el enlace `/exportar?token=…`.
 */
export const solicitar = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    if (!sesion || sesion.usuario.rol !== "admin") throw new Error("No autorizado");

    // Un solo enlace vigente por negocio: los previos sin usar se invalidan.
    const previas = await ctx.db
      .query("exportaciones")
      .withIndex("por_negocio", (q) => q.eq("negocioId", sesion.negocioId))
      .collect();
    for (const e of previas) {
      if (e.usadoEn == null) await ctx.db.delete(e._id);
    }

    const tokenExport = bytesToHex(randomBytes(32));
    await ctx.db.insert("exportaciones", {
      negocioId: sesion.negocioId,
      token: tokenExport,
      expiraEn: Date.now() + EXPORT_MS,
      solicitadoPorId: sesion.usuario._id,
    });
    return { token: tokenExport };
  },
});

/** Estado de un enlace de exportación para la pantalla de descarga (público). */
export const estado = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const exp = await ctx.db
      .query("exportaciones")
      .withIndex("por_token", (q) => q.eq("token", token))
      .first();
    if (!exp) return { estado: "invalida" as const };
    if (exp.usadoEn != null) return { estado: "usada" as const };
    if (exp.expiraEn <= Date.now()) return { estado: "expirada" as const };
    const negocio = await ctx.db.get(exp.negocioId);
    return {
      estado: "valida" as const,
      negocioNombre: negocio?.nombre ?? null,
      expiraEn: exp.expiraEn,
    };
  },
});

/** Recopila y serializa a CSV todos los datos del negocio (4 archivos). */
async function generarArchivos(ctx: MutationCtx, negocioId: import("./_generated/dataModel").Id<"negocios">) {
  const negocio = await ctx.db.get(negocioId);
  const tz = negocio?.zonaHoraria ?? "America/Mexico_City";

  const [clientes, oportunidades, seguimientos, usuarios, etiquetas] = await Promise.all([
    ctx.db.query("clientes").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect(),
    ctx.db.query("oportunidades").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect(),
    ctx.db.query("seguimientos").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect(),
    ctx.db.query("usuarios").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect(),
    ctx.db.query("etiquetas").withIndex("por_negocio", (q) => q.eq("negocioId", negocioId)).collect(),
  ]);
  // `notas` se indexa por cliente: se recogen de todos los clientes del negocio
  // (incluidos los de papelera — el criterio pide TODAS las interacciones).
  const notas = (
    await Promise.all(
      clientes.map((c) => ctx.db.query("notas").withIndex("por_cliente", (q) => q.eq("clienteId", c._id)).collect()),
    )
  ).flat();

  const nombreUsuario = new Map(usuarios.map((u) => [u._id, u.nombre]));
  const nombreCliente = new Map(clientes.map((c) => [c._id, c.nombre]));
  const nombreEtiqueta = new Map(etiquetas.map((e) => [e._id, e.nombre]));
  const nombreOpo = new Map(oportunidades.map((o) => [o._id, o.nombre]));

  // 1) clientes.csv — incluye los de papelera (marcados).
  const clientesCsv = csv(
    ["Nombre", "Tipo", "Teléfono", "Email", "Empresa", "Cargo", "Dirección", "Canal", "Prioridad",
     "Estado", "Etiquetas", "Responsable", "Observaciones", "Última interacción", "Creado",
     "Actualizado", "En papelera", "Eliminado el"],
    clientes.map((c) => [
      c.nombre,
      c.tipo ? (c.tipo === "empresa" ? "Empresa" : "Persona") : "",
      c.telefono, c.email, c.empresa, c.cargo, c.direccion,
      c.canal ? LABELS.canal[c.canal] : "",
      c.prioridad ? LABELS.prioridad[c.prioridad] : "",
      LABELS.estadoCliente[c.estado],
      (c.etiquetaIds ?? []).map((id) => nombreEtiqueta.get(id) ?? "").filter(Boolean).join("; "),
      c.responsableId ? (nombreUsuario.get(c.responsableId) ?? "") : "",
      c.observaciones,
      fechaLocal(c.ultimaInteraccion, tz),
      fechaLocal(c._creationTime, tz),
      fechaLocal(c.actualizadoEn, tz),
      c.eliminadoEn != null ? "Sí" : "No",
      fechaLocal(c.eliminadoEn, tz),
    ]),
  );

  // 2) notas.csv — con referencia al cliente.
  const notasCsv = csv(
    ["Cliente", "Tipo", "Descripción", "Resultado", "Autor", "Fecha"],
    notas.map((n) => [
      nombreCliente.get(n.clienteId) ?? "",
      LABELS.tipoInteraccion[n.tipo],
      n.descripcion, n.resultado,
      nombreUsuario.get(n.autorId) ?? "",
      fechaLocal(n.fecha, tz),
    ]),
  );

  // 3) oportunidades.csv — con referencia al cliente y etapa.
  const oportunidadesCsv = csv(
    ["Cliente", "Nombre", "Producto/servicio", "Monto", "Etapa", "Modelo de venta", "Canal",
     "Fecha de cierre", "Comentarios", "Motivo de cierre", "Motivo de pérdida", "Responsable",
     "Actualizada por", "Creada", "Actualizada"],
    oportunidades.map((o) => [
      nombreCliente.get(o.clienteId) ?? "",
      o.nombre, o.productoServicio,
      o.monto ?? "",
      LABELS.etapa[o.etapa],
      o.modeloVenta ? (o.modeloVenta === "unico" ? "Único" : "Recurrente") : "",
      o.canal ? LABELS.canal[o.canal] : "",
      fechaLocal(o.fechaCierre, tz),
      o.comentarios, o.motivoCierre, o.motivoPerdida,
      o.responsableId ? (nombreUsuario.get(o.responsableId) ?? "") : "",
      o.actualizadoPor ? (nombreUsuario.get(o.actualizadoPor) ?? "") : "",
      fechaLocal(o._creationTime, tz),
      fechaLocal(o.actualizadoEn, tz),
    ]),
  );

  // 4) recordatorios.csv — seguimientos, con destino/cliente, oportunidad y estado.
  const estadoSeg: Record<string, string> = {
    pendiente: "Pendiente", realizado: "Realizado", vencido: "Vencido", cancelado: "Cancelado",
  };
  const recordatoriosCsv = csv(
    ["Destino", "Cliente / Empleado", "Oportunidad", "Título", "Descripción", "Fecha", "Hora",
     "Prioridad", "Frecuencia", "Fecha fin", "Día de recurrencia", "Estado", "Responsable",
     "Notificar", "Automático", "Creado"],
    seguimientos.map((s) => [
      s.destino === "empleado" ? "Empleado" : "Cliente",
      s.destino === "empleado"
        ? (s.empleadoId ? (nombreUsuario.get(s.empleadoId) ?? "") : "")
        : (s.clienteId ? (nombreCliente.get(s.clienteId) ?? "") : ""),
      s.oportunidadId ? (nombreOpo.get(s.oportunidadId) ?? "") : "",
      s.titulo, s.descripcion,
      fechaLocal(s.fecha, tz), s.hora,
      LABELS.prioridad[s.prioridad],
      LABELS.frecuencia[s.frecuencia],
      fechaLocal(s.fechaFin, tz),
      s.diaRecurrencia ?? "",
      estadoSeg[s.estado] ?? s.estado,
      nombreUsuario.get(s.responsableId) ?? "",
      s.notificar ? "Sí" : "No",
      s.origen === "post_venta" ? "Post-venta" : "",
      fechaLocal(s._creationTime, tz),
    ]),
  );

  return [
    { nombre: "clientes.csv", csv: clientesCsv },
    { nombre: "notas.csv", csv: notasCsv },
    { nombre: "oportunidades.csv", csv: oportunidadesCsv },
    { nombre: "recordatorios.csv", csv: recordatoriosCsv },
  ];
}

/**
 * Consume el enlace de exportación (JUA-44). Público (se accede con el token,
 * sin sesión). UN SOLO USO: marca `usadoEn` y devuelve los 4 CSV. Un segundo
 * intento verá el enlace como "usado".
 */
export const consumir = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const exp = await ctx.db
      .query("exportaciones")
      .withIndex("por_token", (q) => q.eq("token", token))
      .first();
    if (!exp) throw new Error("Enlace no válido");
    if (exp.usadoEn != null) throw new Error("Este enlace ya se usó");
    if (exp.expiraEn <= Date.now()) throw new Error("El enlace ha expirado");

    await ctx.db.patch(exp._id, { usadoEn: Date.now() });

    const negocio = await ctx.db.get(exp.negocioId);
    const archivos = await generarArchivos(ctx, exp.negocioId);
    return {
      negocioNombre: negocio?.nombre ?? "negocio",
      generadoEn: Date.now(),
      archivos,
    };
  },
});

/** Purga diaria de exportaciones expiradas o ya usadas (JUA-44). */
export const purgar = internalMutation({
  args: {},
  handler: async (ctx) => {
    const ahora = Date.now();
    const todas = await ctx.db.query("exportaciones").collect();
    for (const e of todas) {
      if (e.usadoEn != null || e.expiraEn <= ahora) await ctx.db.delete(e._id);
    }
  },
});
