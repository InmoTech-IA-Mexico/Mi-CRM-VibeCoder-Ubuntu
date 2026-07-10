// Helpers de zona horaria para el servidor (JUA-28 / JUA-115). Réplica mínima de
// src/lib/fechas.ts para calcular recurrencias en el CALENDARIO DEL NEGOCIO
// (no en UTC), evitando el sesgo de día en recordatorios nocturnos.

/** Desfase (ms) entre la hora local de `tz` y UTC para un instante dado. */
function desfaseZonaMs(tz: string, fecha: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const parte of dtf.formatToParts(fecha)) {
    if (parte.type !== "literal") p[parte.type] = parte.value;
  }
  const comoUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
    fecha.getMilliseconds(),
  );
  return comoUTC - fecha.getTime();
}

/** Componentes de fecha/hora local (en `tz`) de un epoch. `mes` es 1–12. */
export function partesLocales(
  epoch: number,
  tz: string,
): { anio: number; mes: number; dia: number; hora: number; minuto: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const parte of dtf.formatToParts(new Date(epoch))) {
    if (parte.type !== "literal") p[parte.type] = parte.value;
  }
  return {
    anio: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour) % 24,
    minuto: Number(p.minute),
  };
}

/** Epoch de una fecha/hora local (en `tz`). `mes` es 1–12. */
export function epochDeLocal(
  anio: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  tz: string,
): number {
  const comoUTC = Date.UTC(anio, mes - 1, dia, hora, minuto);
  const desfase = desfaseZonaMs(tz, new Date(comoUTC));
  return comoUTC - desfase;
}

/** Número de días del mes `mes` (1–12) del año `anio`. */
export function diasEnMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}
