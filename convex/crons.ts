import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Tareas programadas del CRM.
const crons = cronJobs();

// Papelera (JUA-16): cada día borra definitivamente los clientes con más de 30
// días en papelera (soft-delete). Ejecuta `clientes.purgarPapelera` (interna).
crons.daily("purga-papelera", { hourUTC: 8, minuteUTC: 0 }, internal.clientes.purgarPapelera);

// Inactividad (JUA-26): cada día pasa a "Inactivo" los clientes en Prospecto/Activo
// sin interacción real en 15+ días. Red de seguridad para negocios donde nadie abre
// Inicio (esa pantalla también dispara la sincronización inmediata por negocio).
crons.daily("transicionar-inactivos", { hourUTC: 8, minuteUTC: 30 }, internal.clientes.transicionarInactivos);

// Purga los enlaces de exportación expirados o ya usados (JUA-44).
crons.daily("purga-exportaciones", { hourUTC: 9, minuteUTC: 0 }, internal.exportaciones.purgar);

// Alerta de cliente frío (JUA-33): cada hora vacía la cola `notificacionesPush`,
// enviando las pendientes cuya hora local del negocio es diurna (guard de horario
// por zona horaria) y descartando las obsoletas. Corre cada hora para cubrir todas
// las zonas; el guard evita envíos nocturnos.
crons.hourly("flush-notificaciones-push", { minuteUTC: 15 }, internal.pushEnvio.flushNotificaciones);

export default crons;
