import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Esquema de datos del CRM InmoTech IA México.
// Fuente: CRM-PRD (Notion) + diseño de pantallas. Catálogos en src/lib/enums.ts.
// Convex añade automáticamente _id y _creationTime a cada documento.

const prioridad = v.union(v.literal("alta"), v.literal("media"), v.literal("baja"));
const estadoCliente = v.union(
  v.literal("nuevo"),
  v.literal("prospecto"),
  v.literal("activo"),
  v.literal("inactivo"),
  v.literal("descartado"),
);
const etapa = v.union(
  v.literal("nueva"),
  v.literal("en_contacto"),
  v.literal("propuesta"),
  v.literal("negociacion"),
  v.literal("ganada"),
  v.literal("perdida"),
  v.literal("cancelada"),
);
const canal = v.union(
  v.literal("whatsapp"),
  v.literal("email"),
  v.literal("web"),
  v.literal("telefono"),
  v.literal("referido"),
  v.literal("redes"),
);
const tipoInteraccion = v.union(
  v.literal("llamada"),
  v.literal("reunion"),
  v.literal("correo"),
  v.literal("mensaje"),
  v.literal("visita"),
  v.literal("interno"),
);
const frecuencia = v.union(v.literal("una_vez"), v.literal("semanal"), v.literal("mensual"));
const rol = v.union(v.literal("admin"), v.literal("operativo"));

export default defineSchema({
  // Contenedor multi-tenant: todo pertenece a un negocio.
  negocios: defineTable({
    nombre: v.string(),
    emailAdmin: v.string(),
    zonaHoraria: v.string(),
    estado: v.union(v.literal("activo"), v.literal("suspendido")),
  }),

  usuarios: defineTable({
    negocioId: v.id("negocios"),
    nombre: v.string(),
    email: v.string(),
    rol,
    estado: v.union(v.literal("activo"), v.literal("pendiente"), v.literal("inactivo")),
    ultimoAcceso: v.optional(v.number()),
    // Autenticación (JUA-6):
    passwordHash: v.optional(v.string()), // "saltHex:hashHex" (scrypt)
    intentosFallidos: v.optional(v.number()),
    bloqueadoHasta: v.optional(v.number()), // epoch; si > ahora, cuenta bloqueada
  })
    .index("por_email", ["email"])
    .index("por_negocio", ["negocioId"]),

  invitaciones: defineTable({
    negocioId: v.id("negocios"),
    email: v.string(),
    rol,
    estado: v.union(v.literal("pendiente"), v.literal("aceptada"), v.literal("expirada")),
    token: v.string(),
    expiraEn: v.number(),
  }).index("por_token", ["token"]),

  clientes: defineTable({
    negocioId: v.id("negocios"),
    nombre: v.string(),
    tipo: v.optional(v.union(v.literal("persona"), v.literal("empresa"))),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    empresa: v.optional(v.string()),
    cargo: v.optional(v.string()),
    direccion: v.optional(v.string()),
    canal: v.optional(canal),
    prioridad: v.optional(prioridad),
    estado: estadoCliente,
    observaciones: v.optional(v.string()),
    responsableId: v.optional(v.id("usuarios")),
    ultimaInteraccion: v.optional(v.number()),
    actualizadoEn: v.optional(v.number()), // fecha_ultima_actualizacion (JUA-13)
    eliminadoEn: v.optional(v.number()), // papelera (soft delete, 30 días)
  })
    .index("por_negocio", ["negocioId"])
    .index("por_responsable", ["responsableId"]),

  notas: defineTable({
    negocioId: v.id("negocios"),
    clienteId: v.id("clientes"),
    tipo: tipoInteraccion,
    descripcion: v.string(),
    resultado: v.optional(v.string()),
    autorId: v.id("usuarios"),
    fecha: v.number(),
  }).index("por_cliente", ["clienteId"]),

  oportunidades: defineTable({
    negocioId: v.id("negocios"),
    clienteId: v.id("clientes"),
    nombre: v.string(),
    productoServicio: v.optional(v.string()),
    monto: v.optional(v.number()),
    etapa,
    fechaCierre: v.optional(v.number()),
    responsableId: v.optional(v.id("usuarios")),
    modeloVenta: v.optional(v.union(v.literal("unico"), v.literal("recurrente"))),
    canal: v.optional(canal),
    comentarios: v.optional(v.string()),
    motivoCierre: v.optional(v.string()), // notas de cierre al Ganar
    motivoPerdida: v.optional(v.string()),
  }).index("por_cliente", ["clienteId"]),

  seguimientos: defineTable({
    negocioId: v.id("negocios"),
    destino: v.union(v.literal("cliente"), v.literal("empleado")),
    clienteId: v.optional(v.id("clientes")),
    empleadoId: v.optional(v.id("usuarios")),
    oportunidadId: v.optional(v.id("oportunidades")),
    titulo: v.string(),
    descripcion: v.optional(v.string()),
    fecha: v.number(),
    hora: v.optional(v.string()),
    responsableId: v.id("usuarios"),
    prioridad,
    frecuencia,
    fechaFin: v.optional(v.number()),
    estado: v.union(
      v.literal("pendiente"),
      v.literal("realizado"),
      v.literal("vencido"),
      v.literal("cancelado"),
    ),
    notificar: v.optional(v.boolean()),
  })
    .index("por_negocio", ["negocioId"])
    .index("por_responsable", ["responsableId"])
    .index("por_cliente", ["clienteId"]),

  ventas: defineTable({
    negocioId: v.id("negocios"),
    clienteId: v.id("clientes"),
    oportunidadId: v.optional(v.id("oportunidades")),
    importe: v.number(),
    fecha: v.number(),
    canal: v.optional(canal),
    registradoPorId: v.id("usuarios"),
  })
    .index("por_negocio", ["negocioId"])
    .index("por_cliente", ["clienteId"]),

  // Sesiones de autenticación (JUA-6). El cliente guarda `token` en localStorage;
  // la sesión expira a las 8 h (deslizante) y está ligada al negocio.
  sesiones: defineTable({
    usuarioId: v.id("usuarios"),
    negocioId: v.id("negocios"),
    token: v.string(),
    expiraEn: v.number(),
  }).index("por_token", ["token"]),
});
