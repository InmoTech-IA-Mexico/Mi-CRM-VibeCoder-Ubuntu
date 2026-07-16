// Etiquetas legibles (ES) para el SERVIDOR. Réplica mínima de las de
// src/lib/enums.ts (LABELS) para usarlas en Convex — que no puede importar desde
// src/. Mantener SINCRONIZADO con src/lib/enums.ts. Hoy solo lo usa la
// exportación de datos (JUA-44), que necesita valores legibles en los CSV.

export const LABELS = {
  prioridad: { alta: "Alta", media: "Media", baja: "Baja" },
  estadoCliente: { nuevo: "Nuevo", prospecto: "Prospecto", activo: "Activo", inactivo: "Inactivo", descartado: "Descartado" },
  etapa: { nueva: "Nueva", en_contacto: "En contacto", propuesta: "Propuesta", negociacion: "Negociación", ganada: "Ganada", perdida: "Perdida", cancelada: "Cancelada" },
  canal: { whatsapp: "WhatsApp", email: "Email", web: "Web", telefono: "Teléfono", referido: "Referido", redes: "Redes" },
  tipoInteraccion: { llamada: "Llamada", reunion: "Reunión", correo: "Correo", mensaje: "Mensaje", visita: "Visita", interno: "Interno" },
  frecuencia: { una_vez: "Una vez", semanal: "Semanal", mensual: "Mensual" },
  rol: { admin: "Administrador", operativo: "Operativo", observador: "Observador" },
} as const;
