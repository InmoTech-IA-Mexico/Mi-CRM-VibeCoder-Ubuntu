// Driver 18 — test UNITARIO de la serialización CSV real (OBS-3 dictamen v2).
// Importa `convex/csv.ts` directamente (Node 24 --experimental-strip-types) y
// ejercita la TABLA COMPLETA de iniciadores de fórmula, incluidos tab/CR/LF y
// las variantes de ancho completo que el driver de fixtures no crea vía UI.
// Uso: REPO_DIR=/ruta/al/repo node --experimental-strip-types driver-18-csv-unit.mjs [rutaReporte]
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const REPO_DIR = process.env.REPO_DIR || "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM";
const { csvCampo, csv } = await import(pathToFileURL(`${REPO_DIR}/convex/csv.ts`).href);

const REPORTE = process.argv[2] || "/tmp/reporte-csv-unit.txt";
const resultados = [];
const fallos = [];
const ok = (cond, msg) => {
  const l = `${cond ? "PASS" : "FAIL"} — ${msg}`;
  console.log(l);
  resultados.push(l);
  if (!cond) fallos.push(msg);
};

// Cada iniciador de fórmula debe quedar prefijado con apóstrofo.
for (const [c, nombre] of [
  ["=", "igual"], ["+", "más"], ["-", "menos"], ["@", "arroba"],
  ["\t", "tabulador"], ["\r", "CR"], ["\n", "LF"],
  ["＝", "igual ancho completo"], ["＋", "más ancho completo"],
  ["－", "menos ancho completo"], ["＠", "arroba ancho completo"],
]) {
  const salida = csvCampo(c + "1+1");
  ok(salida.startsWith("'") || salida.startsWith('"\''), `neutraliza inicio '${nombre}' → ${JSON.stringify(salida)}`);
}

// Texto benigno NO se toca.
ok(csvCampo("Ana García") === "Ana García", "texto normal intacto");
ok(csvCampo("55 1002 3040") === "55 1002 3040", "teléfono sin '+' intacto");

// Números (incluido negativo) NO se prefijan.
ok(csvCampo(-500) === "-500", "monto -500 (number) intacto, sin apóstrofo");
ok(csvCampo(0) === "0", "cero (number) intacto");
ok(csvCampo(1200000) === "1200000", "monto grande (number) intacto");

// Escape RFC 4180: coma, comilla y salto fuerzan comillas; comillas se doblan.
ok(csvCampo("a,b") === '"a,b"', "coma → campo citado");
ok(csvCampo('di "hola"') === '"di ""hola"""', "comillas dobladas y citado");
ok(csvCampo("línea1\nlínea2") === '"línea1\nlínea2"', "salto de línea → citado");

// Combinado: fórmula + coma + comillas (el caso del driver de fixtures).
ok(csvCampo('@Oportunidad, QA "fx"') === '"\'@Oportunidad, QA ""fx"""', "fórmula + coma + comillas: apóstrofo dentro de comillas dobladas");

// csv(): BOM al inicio, CRLF entre filas.
const salidaCsv = csv(["A", "B"], [["1", "x"]]);
ok(salidaCsv.charCodeAt(0) === 0xfeff, "csv() añade BOM");
ok(salidaCsv.includes("A,B\r\n1,x\r\n"), "csv() usa CRLF");

// null/undefined → vacío.
ok(csvCampo(null) === "" && csvCampo(undefined) === "", "null/undefined → vacío");

fs.writeFileSync(REPORTE, [
  "Reporte driver-18 CSV unit (JUA-44, OBS-3)",
  `fecha: ${new Date().toISOString()}`,
  `resultado: ${fallos.length === 0 ? "OK" : "CON FALLOS"} (${resultados.filter((r) => r.startsWith("PASS")).length} PASS / ${fallos.length} FAIL)`,
  "", ...resultados,
].join("\n") + "\n");
console.log(`\nReporte en ${REPORTE}`);
process.exit(fallos.length ? 1 : 0);
