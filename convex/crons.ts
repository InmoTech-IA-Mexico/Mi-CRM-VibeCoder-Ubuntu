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

// OAuth de Google (JUA-40): purga programada de los nonces expirados (TTL 5 min), como
// red de seguridad además de la purga perezosa al emitir. Acota el tamaño de la tabla.
crons.hourly("purgar-nonces-oauth", { minuteUTC: 45 }, internal.google.purgarNoncesExpirados);

// Correo transaccional (JUA-129): red de seguridad de la cola durable. El envío normal
// lo dispara `encolar` con un flush inmediato; este cron reclama los eventos que
// quedaron pendientes por un fallo transitorio (backoff) o una action caída (lease
// vencido), y recoge la acumulación si el envío estuvo deshabilitado (sin Resend).
crons.interval("flush-emails", { minutes: 5 }, internal.emailEnvio.flush, {});

// Retención de la outbox de correo (JUA-129, obs. escala): purga diaria de los eventos
// terminales (enviado/descartado) con más de 7 días, para que la tabla no crezca sin fin.
crons.daily("purgar-emails-antiguos", { hourUTC: 9, minuteUTC: 30 }, internal.emailCola.purgarAntiguos);

// Registro público (JUA-39): purga los registros pendientes vencidos (24 h) por rango
// indexado, para que la tabla no crezca bajo abuso (obs. B-3). Cada 15 min.
crons.interval("purgar-registros-pendientes", { minutes: 15 }, internal.registro.purgarPendientes, {});

export default crons;
