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
export const canal = v.union(
  v.literal("whatsapp"),
  v.literal("email"),
  v.literal("web"),
  v.literal("telefono"),
  v.literal("referido"),
  v.literal("redes"),
);
// Fuente de contacto (JUA-38): origen específico, más granular que el canal.
export const fuenteContacto = v.union(
  v.literal("referido"),
  v.literal("campana"),
  v.literal("evento"),
  v.literal("visita"),
  v.literal("otro"),
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
export const rol = v.union(v.literal("admin"), v.literal("operativo"), v.literal("observador"));

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
    // Preferencia de alertas push de cliente frío (JUA-33). Ausente = por defecto de
    // rol (operativo: "cartera"; admin: "ninguna", opt-in).
    prefClienteFrio: v.optional(
      v.union(v.literal("ninguna"), v.literal("cartera"), v.literal("pool"), v.literal("negocio")),
    ),
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
    nombre: v.optional(v.string()), // nombre sugerido del invitado (JUA-29)
    rol,
    estado: v.union(v.literal("pendiente"), v.literal("aceptada"), v.literal("expirada")),
    token: v.string(),
    expiraEn: v.number(),
  })
    .index("por_token", ["token"])
    .index("por_negocio", ["negocioId"]),

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
    // Fuente de contacto (JUA-38): categoría + detalle libre, ambos opcionales.
    fuenteTipo: v.optional(fuenteContacto),
    fuenteDetalle: v.optional(v.string()),
    prioridad: v.optional(prioridad),
    estado: estadoCliente,
    observaciones: v.optional(v.string()),
    responsableId: v.optional(v.id("usuarios")),
    // Etiquetas de producto del cliente (JUA-36): 0..n, del catálogo del negocio.
    etiquetaIds: v.optional(v.array(v.id("etiquetas"))),
    ultimaInteraccion: v.optional(v.number()),
    actualizadoEn: v.optional(v.number()), // fecha_ultima_actualizacion (JUA-13)
    eliminadoEn: v.optional(v.number()), // papelera (soft delete, 30 días)
  })
    .index("por_negocio", ["negocioId"])
    .index("por_responsable", ["responsableId"]),

  // Catálogo de etiquetas de producto del negocio (JUA-36). Configurable por la
  // administradora (no es una lista fija); los clientes referencian por id.
  etiquetas: defineTable({
    negocioId: v.id("negocios"),
    nombre: v.string(),
  }).index("por_negocio", ["negocioId"]),

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
    actualizadoEn: v.optional(v.number()), // trazabilidad del último cambio (JUA-21)
    actualizadoPor: v.optional(v.id("usuarios")),
  })
    .index("por_cliente", ["clienteId"])
    .index("por_negocio", ["negocioId"]),

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
    diaRecurrencia: v.optional(v.number()), // ancla día-del-mes para mensual (JUA-115)
    estado: v.union(
      v.literal("pendiente"),
      v.literal("realizado"),
      v.literal("vencido"),
      v.literal("cancelado"),
    ),
    notificar: v.optional(v.boolean()),
    // Marca de seguimiento creado automáticamente por el sistema (JUA-37):
    // permite no duplicarlo y cancelarlo si la oportunidad deja de estar ganada.
    origen: v.optional(v.literal("post_venta")),
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
  })
    .index("por_token", ["token"])
    .index("por_usuario", ["usuarioId"]),

  // Recuperación de contraseña (JUA-7). Token de un solo uso, expira en 24 h.
  recuperaciones: defineTable({
    usuarioId: v.id("usuarios"),
    token: v.string(),
    expiraEn: v.number(),
    usadoEn: v.optional(v.number()),
  })
    .index("por_token", ["token"])
    .index("por_usuario", ["usuarioId"]),

  // Exportación de datos en autoservicio (JUA-44). Solo guarda el METADATO del
  // enlace temporal: token único, 24 h, un solo uso. Los CSV NO se almacenan —
  // se generan al consumir el enlace y se devuelven al cliente. Un cron purga
  // las filas expiradas.
  exportaciones: defineTable({
    negocioId: v.id("negocios"),
    token: v.string(),
    expiraEn: v.number(),
    usadoEn: v.optional(v.number()),
    solicitadoPorId: v.id("usuarios"),
  })
    .index("por_token", ["token"])
    .index("por_negocio", ["negocioId"]),

  // Suscripciones Web Push (JUA-33): un dispositivo/navegador = una fila
  // (identificada por su `endpoint` único). Guarda las claves de cifrado del
  // navegador (p256dh/auth) para poder enviarle notificaciones. El usuario se
  // suscribe desde /perfil con permiso explícito; se borra al desactivar o si el
  // push service responde 404/410 (caducada).
  pushSubscriptions: defineTable({
    usuarioId: v.id("usuarios"),
    negocioId: v.id("negocios"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    creadoEn: v.number(),
  })
    .index("por_endpoint", ["endpoint"])
    .index("por_usuario", ["usuarioId"]),

  // Cola de notificaciones push (JUA-33, Fase C): se ENCOLA una fila al pasar un
  // cliente a Inactivo (cliente frío), con destinatario. Un cron `flush` reclama un
  // lote (estado `enviando` con lease), lo envía y registra el resultado real
  // (éxito / sin dispositivos / reintento con backoff / fallo persistente). El lease
  // permite recuperar entregas cuya action cayó a medias. Estados: pendiente →
  // enviando → enviada / descartada. El evento CRM es único; la entrega externa es
  // best-effort (puede duplicarse excepcionalmente tras una recuperación).
  notificacionesPush: defineTable({
    negocioId: v.id("negocios"),
    usuarioId: v.id("usuarios"), // destinatario
    clienteId: v.id("clientes"),
    tipo: v.literal("cliente_frio"),
    estado: v.union(
      v.literal("pendiente"),
      v.literal("enviando"),
      v.literal("enviada"),
      v.literal("descartada"),
    ),
    intentos: v.optional(v.number()),
    proximoIntento: v.optional(v.number()), // epoch; elegible cuando <= ahora
    leaseHasta: v.optional(v.number()), // epoch; vigencia de la reclamación "enviando"
    resultado: v.optional(v.string()), // razón del estado terminal
    creadoEn: v.number(),
    enviadaEn: v.optional(v.number()),
  })
    .index("por_estado", ["estado"])
    .index("por_cliente_tipo", ["clienteId", "tipo"]),
});
