import type { Doc, Id } from "./_generated/dataModel";

// Regla de inactividad de clientes (Fase 6), compartida por las tres superficies
// para que sean SIEMPRE coherentes entre sí:
//   - panel "Requieren atención" (JUA-25, inicio.panelInactividad)
//   - estado global de clientes (JUA-35, inicio.estadoGlobal)
//   - transición automática a Inactivo (JUA-26, clientes.transicionar*)
//
// El umbral de 15 días se mide como DURACIÓN transcurrida (≥15×24 h), invariante a
// la zona horaria (nunca se usa el calendario local del servidor).

export const MS_DIA = 24 * 60 * 60 * 1000;
export const DIAS_INACTIVIDAD = 15; // días sin interacción real (PRD)
export const PROXIMOS_DIAS_RECORDATORIO = 3; // ventana de "ya hay seguimiento planificado"

/** Días transcurridos desde la última interacción real (o el alta si no hubo). */
export function diasSinContacto(c: Doc<"clientes">, ahora: number): number {
  const referencia = c.ultimaInteraccion ?? c._creationTime;
  return Math.floor((ahora - referencia) / MS_DIA);
}

/**
 * Clientes con un recordatorio PENDIENTE a cliente en los próximos 3 días: ya
 * tienen seguimiento planificado, así que NO cuentan como desatendidos ni se
 * transicionan a Inactivo. Devuelve el conjunto de sus `clienteId`.
 */
export function recordatorioProximoIds(
  seguimientos: Doc<"seguimientos">[],
  ahora: number,
): Set<Id<"clientes">> {
  const limite = ahora + PROXIMOS_DIAS_RECORDATORIO * MS_DIA;
  const ids = new Set<Id<"clientes">>();
  for (const s of seguimientos) {
    if (
      s.estado === "pendiente" &&
      s.destino === "cliente" &&
      s.clienteId != null &&
      s.fecha >= ahora &&
      s.fecha <= limite
    ) {
      ids.add(s.clienteId);
    }
  }
  return ids;
}

export type PrefFrio = "ninguna" | "cartera" | "pool" | "negocio";

/**
 * Preferencia EFECTIVA de alertas de cliente frío (JUA-33 B-2). FUENTE ÚNICA de
 * verdad, usada tanto al ENCOLAR (`clientes.encolarClienteFrio`) como al REVALIDAR
 * el destino al reclamar (`notificaciones.revalidarDestino`): que ambas rutas usen
 * la MISMA regla es justo lo que faltaba en el defecto B-1/B-2 (el encolado fijaba
 * una audiencia que la reclamación luego ignoraba). Ausente → por defecto de rol:
 * el operativo recibe su cartera; el admin y el observador quedan en "ninguna"
 * (opt-in explícito del admin; el observador no gestiona cartera → nunca recibe).
 */
export function prefFrioEfectiva(rol: string, pref: string | undefined): PrefFrio {
  if (pref === "ninguna" || pref === "cartera" || pref === "pool" || pref === "negocio") return pref;
  return rol === "operativo" ? "cartera" : "ninguna";
}

/** Preferencia efectiva de alertas de cliente frío de un usuario (conveniencia sobre `prefFrioEfectiva`). */
export function prefFrio(u: Doc<"usuarios">): PrefFrio {
  return prefFrioEfectiva(u.rol, u.prefClienteFrio);
}

/**
 * ¿El cliente debe pasar automáticamente a Inactivo? (JUA-26). Mismo criterio que
 * el panel/estado global: en Prospecto o Activo, no en papelera, 15+ días sin
 * interacción real y SIN recordatorio próximo planificado. Nuevo y Descartado no
 * se ven afectados; Inactivo es el único estado que el sistema asigna solo.
 */
export function debeMarcarseInactivo(
  c: Doc<"clientes">,
  ahora: number,
  conRecordatorioProximo: Set<Id<"clientes">>,
): boolean {
  if (c.eliminadoEn != null) return false;
  if (c.estado !== "prospecto" && c.estado !== "activo") return false;
  if (conRecordatorioProximo.has(c._id)) return false;
  return diasSinContacto(c, ahora) >= DIAS_INACTIVIDAD;
}
