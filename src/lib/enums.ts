// Catálogos de dominio del CRM (PRD + diseño "InmoTech IA México").
// Mantener sincronizado con convex/schema.ts.

export const PRIORIDADES = ["alta", "media", "baja"] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const ESTADOS_CLIENTE = ["nuevo", "prospecto", "activo", "inactivo", "descartado"] as const;
export type EstadoCliente = (typeof ESTADOS_CLIENTE)[number];

export const ETAPAS_PIPELINE = ["nueva", "en_contacto", "propuesta", "negociacion", "ganada", "perdida", "cancelada"] as const;
export type EtapaPipeline = (typeof ETAPAS_PIPELINE)[number];

export const CANALES = ["whatsapp", "email", "web", "telefono", "referido", "redes"] as const;
export type Canal = (typeof CANALES)[number];

// Fuente de contacto (JUA-38): origen específico de cómo llegó el cliente. Es un
// nivel más granular que el canal (medio) — categoría + detalle libre opcional.
export const FUENTES_CONTACTO = ["referido", "campana", "evento", "visita", "otro"] as const;
export type FuenteContacto = (typeof FUENTES_CONTACTO)[number];

export const TIPOS_INTERACCION = ["llamada", "reunion", "correo", "mensaje", "visita", "interno"] as const;
export type TipoInteraccion = (typeof TIPOS_INTERACCION)[number];

export const FRECUENCIAS = ["una_vez", "semanal", "mensual"] as const;
export type Frecuencia = (typeof FRECUENCIAS)[number];

export const ROLES = ["admin", "operativo", "observador"] as const;
export type Rol = (typeof ROLES)[number];

export const ESTADOS_CUENTA = ["activo", "pendiente", "inactivo"] as const;
export type EstadoCuenta = (typeof ESTADOS_CUENTA)[number];

export const ESTADOS_SEGUIMIENTO = ["pendiente", "realizado", "vencido", "cancelado"] as const;
export type EstadoSeguimiento = (typeof ESTADOS_SEGUIMIENTO)[number];

export const DESTINOS_SEGUIMIENTO = ["cliente", "empleado"] as const;
export type DestinoSeguimiento = (typeof DESTINOS_SEGUIMIENTO)[number];

/** Etiquetas legibles (ES) para la UI. */
export const LABELS = {
  prioridad: { alta: "Alta", media: "Media", baja: "Baja" },
  estadoCliente: { nuevo: "Nuevo", prospecto: "Prospecto", activo: "Activo", inactivo: "Inactivo", descartado: "Descartado" },
  etapa: { nueva: "Nueva", en_contacto: "En contacto", propuesta: "Propuesta", negociacion: "Negociación", ganada: "Ganada", perdida: "Perdida", cancelada: "Cancelada" },
  canal: { whatsapp: "WhatsApp", email: "Email", web: "Web", telefono: "Teléfono", referido: "Referido", redes: "Redes" },
  fuenteContacto: { referido: "Referido", campana: "Campaña", evento: "Evento", visita: "Visita", otro: "Otro" },
  tipoInteraccion: { llamada: "Llamada", reunion: "Reunión", correo: "Correo", mensaje: "Mensaje", visita: "Visita", interno: "Interno" },
  frecuencia: { una_vez: "Una vez", semanal: "Semanal", mensual: "Mensual" },
  rol: { admin: "Administrador", operativo: "Operativo", observador: "Observador" },
} as const;

/** Reglas de negocio (PRD). */
export const DIAS_INACTIVIDAD = 15;
export const DIAS_PAPELERA = 30;
