import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Tareas programadas del CRM.
const crons = cronJobs();

// Papelera (JUA-16): cada día borra definitivamente los clientes con más de 30
// días en papelera (soft-delete). Ejecuta `clientes.purgarPapelera` (interna).
crons.daily("purga-papelera", { hourUTC: 8, minuteUTC: 0 }, internal.clientes.purgarPapelera);

export default crons;
