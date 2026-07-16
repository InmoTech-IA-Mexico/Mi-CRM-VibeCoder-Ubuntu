// Serialización CSV segura (JUA-44). Sin dependencias de Convex → unitariamente
// comprobable (ver auditorias/.../driver-18-csv-unit.mjs).

// Caracteres que, al INICIO de una celda, una hoja de cálculo (Excel/LibreOffice)
// interpreta como fórmula → CSV/formula injection (OWASP). Incluye las variantes
// Unicode de ancho completo y los controles tab/CR/LF.
export const INICIO_FORMULA = /^[=+\-@\t\r\n＝＋－＠]/;

/**
 * Serializa un valor para una celda CSV. Números → tal cual (no son texto de
 * usuario; un `-500` queda como número negativo real). Texto → si empieza con un
 * iniciador de fórmula se prefija con **apóstrofo** ANTES del escape RFC 4180
 * (comillas dobles si hay coma/comilla/salto).
 *
 * El apóstrofo neutraliza la ejecución de la fórmula (la hoja interpreta la celda
 * como texto). Es un compromiso de compatibilidad documentado: NO existe una
 * estrategia idéntica para todos los lectores CSV, y según el lector el apóstrofo
 * puede quedar VISIBLE al inicio de la celda (altera la representación, no el
 * dato de origen). Se prioriza la seguridad sobre la estética.
 */
export function csvCampo(valor: unknown): string {
  if (valor == null) return "";
  if (typeof valor === "number") return String(valor);
  let s = String(valor);
  if (INICIO_FORMULA.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Arma un CSV con BOM (para que Excel lea bien los acentos) y filas CRLF. */
export function csv(cabeceras: string[], filas: unknown[][]): string {
  const lineas = [cabeceras, ...filas].map((f) => f.map(csvCampo).join(","));
  return "﻿" + lineas.join("\r\n") + "\r\n";
}
