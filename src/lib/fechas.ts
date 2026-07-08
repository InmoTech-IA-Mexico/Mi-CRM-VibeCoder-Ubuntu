// Utilidades de fecha para el CRM. La app calcula "hoy" y "hace X días" en la
// zona horaria del negocio (no la del dispositivo), así el cálculo es
// consistente para todo el equipo.
//
// TODO(JUA-28): centralizar el manejo de zona horaria (esta es una versión
// simple; alrededor de cambios de horario de verano puede desviarse una hora).

const MS_DIA = 24 * 60 * 60 * 1000;

/** Diferencia en ms entre la hora local de `tz` y UTC para un instante dado. */
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

/** Rango [inicioDia, finDia) del día que contiene `ahora`, en la zona `tz`. */
export function rangoDiaEnZona(
  tz: string,
  ahora: number = Date.now(),
): { inicioDia: number; finDia: number } {
  const desfase = desfaseZonaMs(tz, new Date(ahora));
  const local = new Date(ahora + desfase);
  const medianocheLocalUTC = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  const inicioDia = medianocheLocalUTC - desfase;
  return { inicioDia, finDia: inicioDia + MS_DIA };
}

/** Fecha larga en español, p. ej. "Miércoles, 18 jun". */
export function fechaLargaES(epoch: number, tz: string): string {
  const partes = new Intl.DateTimeFormat("es-MX", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(epoch));
  const obtener = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  const diaSemana = obtener("weekday");
  const dia = obtener("day");
  const mes = obtener("month").replace(".", "");
  const diaSemanaCap = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  return `${diaSemanaCap}, ${dia} ${mes}`;
}

/**
 * Epoch (ms) del instante que corresponde a una fecha/hora de "reloj de pared"
 * en la zona `tz`. `fechaISO` = "YYYY-MM-DD"; `hora` = "HH:MM" (vacío → 00:00).
 * Se usa para programar recordatorios en la zona del negocio (JUA-22), no en UTC.
 */
export function epochDesdeFechaHora(fechaISO: string, hora: string, tz: string): number {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const [hh, mm] = (hora || "00:00").split(":").map(Number);
  const comoUTC = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  // Corrige por el desfase de la zona en ese instante (aprox.; ver TODO JUA-28).
  const desfase = desfaseZonaMs(tz, new Date(comoUTC));
  return comoUTC - desfase;
}

export type PeriodoVentas = "mes" | "trimestre" | "año";

/**
 * Rango [desde, hasta) del periodo actual y del anterior, en la zona `tz`
 * (JUA-112: KPIs de ventas mes/trimestre/año, en zona del negocio). Se calcula en
 * el cliente y se pasa a la query para que quede determinista.
 */
export function rangoPeriodoEnZona(
  periodo: PeriodoVentas,
  tz: string,
  ahora: number = Date.now(),
): { desde: number; hasta: number; desdePrev: number; hastaPrev: number } {
  // Fecha local (en tz) de "ahora" → año y mes (1-based).
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ahora));
  const [y, m] = iso.split("-").map(Number);
  const m0 = m - 1; // mes 0-based

  // Inicio del mes (yy, mm 0-based, con desbordes normalizados) en la zona tz.
  const inicioMes = (yy: number, mm: number): number => {
    const d = new Date(Date.UTC(yy, mm, 1));
    const fechaISO = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    return epochDesdeFechaHora(fechaISO, "00:00", tz);
  };

  if (periodo === "año") {
    return {
      desde: inicioMes(y, 0),
      hasta: inicioMes(y + 1, 0),
      desdePrev: inicioMes(y - 1, 0),
      hastaPrev: inicioMes(y, 0),
    };
  }
  if (periodo === "trimestre") {
    const q = Math.floor(m0 / 3) * 3;
    return {
      desde: inicioMes(y, q),
      hasta: inicioMes(y, q + 3),
      desdePrev: inicioMes(y, q - 3),
      hastaPrev: inicioMes(y, q),
    };
  }
  // mes
  return {
    desde: inicioMes(y, m0),
    hasta: inicioMes(y, m0 + 1),
    desdePrev: inicioMes(y, m0 - 1),
    hastaPrev: inicioMes(y, m0),
  };
}

/** Fecha corta en español, p. ej. "28 jun". */
export function fechaCortaES(epoch: number, tz: string): string {
  const partes = new Intl.DateTimeFormat("es-MX", {
    timeZone: tz,
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(epoch));
  const dia = partes.find((p) => p.type === "day")?.value ?? "";
  const mes = (partes.find((p) => p.type === "month")?.value ?? "").replace(".", "");
  return `${dia} ${mes}`;
}

/** Días enteros transcurridos desde `epoch` hasta `ahora`. */
export function diasDesde(epoch: number, ahora: number = Date.now()): number {
  return Math.floor((ahora - epoch) / MS_DIA);
}

/** Clase de color para "Hace X días" según urgencia (acorde al diseño). */
export function colorUrgenciaDias(dias: number): string {
  if (dias >= 19) return "text-danger";
  if (dias >= 17) return "text-gold-700";
  return "text-gold-600";
}
