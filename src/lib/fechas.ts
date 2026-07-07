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
