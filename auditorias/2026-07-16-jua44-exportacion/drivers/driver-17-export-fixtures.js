// Driver 17 — JUA-44 remediación (dictamen v1 NO-GO):
//  B-1: valores con inicio de fórmula (= + - @) y comas/comillas/saltos → los
//       CSV los neutralizan (prefijo apóstrofo) y escapan (RFC 4180).
//  B-2: fixtures NO vacíos de oportunidad (comentarios + actualizadoPor) y de
//       recordatorio (oportunidad vinculada, fecha fin, día de recurrencia) →
//       aparecen en oportunidades.csv y recordatorios.csv.
// Usa `npx convex run` (sin secretos en el reporte). Limpia sus fixtures en finally.
// Uso: ADMIN_PASS=... node driver-17-export-fixtures.js [rutaReporte]
const { execFileSync } = require("child_process");
const fs = require("fs");

const CWD = process.env.REPO_DIR || "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM"; // OBS-6: configurable
const ADMIN_PASS = process.env.ADMIN_PASS;

// Parsea una línea CSV (RFC 4180) en celdas, deshaciendo el escape y el
// apóstrofo de neutralización, para aserciones POR COLUMNA (OBS-4).
function celdas(linea) {
  const out = [];
  let cur = "", enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (enComillas) {
      if (ch === '"' && linea[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') enComillas = false;
      else cur += ch;
    } else if (ch === '"') enComillas = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
/** Devuelve la fila (objeto cabecera→celda) cuya celda `col` contiene `substr`. */
function filaPorCelda(csvTexto, col, substr) {
  const lineas = csvTexto.replace(/^﻿/, "").split("\r\n").filter(Boolean);
  const cab = celdas(lineas[0]);
  const idx = cab.indexOf(col);
  for (const l of lineas.slice(1)) {
    const c = celdas(l);
    if (idx >= 0 && (c[idx] ?? "").includes(substr)) {
      return Object.fromEntries(cab.map((h, i) => [h, c[i] ?? ""]));
    }
  }
  return null;
}
const PROD = process.env.EXPORT_PROD === "1" ? ["--prod"] : [];
const REPORTE = process.argv[2] || "/tmp/reporte-export-fixtures.txt";

function run(fn, args) {
  const out = execFileSync("npx", ["convex", "run", ...PROD, fn, JSON.stringify(args)], {
    cwd: CWD, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  // `npx convex run` imprime el valor de retorno como JSON (string id, objeto…).
  try { return JSON.parse(out); } catch {}
  const i = out.indexOf("{");
  const j = out.lastIndexOf("}");
  return i >= 0 && j >= 0 ? JSON.parse(out.slice(i, j + 1)) : out;
}

(async () => {
  if (!ADMIN_PASS) throw new Error("Falta ADMIN_PASS en el entorno");
  const resultados = [];
  const fallos = [];
  const ok = (cond, msg) => {
    const l = `${cond ? "PASS" : "FAIL"} — ${msg}`;
    console.log(l);
    resultados.push(l);
    if (!cond) fallos.push(msg);
  };

  const T = run("auth:iniciarSesion", { email: "marta@demo.mx", password: ADMIN_PASS }).token;
  const MAL_NOMBRE = "=1+1 Cliente QA-fx";     // fórmula
  const MAL_TEL = "+52 55 0000 1111";           // empieza con +
  const OPORTUNIDAD_NOMBRE = "@Oportunidad, QA \"fx\""; // @ + coma + comillas
  const COMENTARIO = "-Comentario con guion inicial";  // empieza con -
  let clienteId, oportunidadId;

  try {
    clienteId = run("clientes:crear", { token: T, nombre: MAL_NOMBRE, telefono: MAL_TEL, email: "qa-fx@demo.mx" });
    oportunidadId = run("oportunidades:crear", {
      token: T, clienteId, nombre: OPORTUNIDAD_NOMBRE, comentarios: COMENTARIO, monto: -500,
    });
    // Cambiar etapa → deja `actualizadoPor` (Marta) en la oportunidad.
    run("oportunidades:cambiarEtapa", { token: T, oportunidadId, etapa: "propuesta" });
    // Recordatorio recurrente mensual vinculado a la oportunidad, con fechaFin y día.
    run("seguimientos:crear", {
      token: T, clienteId, oportunidadId, titulo: "QA-fx recordatorio",
      fecha: 1786000000000, prioridad: "media", frecuencia: "mensual",
      fechaFin: 1788000000000, diaRecurrencia: 15,
    });

    const tk = run("exportaciones:solicitar", { token: T }).token;
    const exp = run("exportaciones:consumir", { token: tk });
    const A = Object.fromEntries(exp.archivos.map((a) => [a.nombre, a.csv]));

    // B-1: neutralización de fórmula
    ok(A["clientes.csv"].includes("'=1+1 Cliente QA-fx"), "B-1: nombre con '=' neutralizado (prefijo apóstrofo)");
    ok(A["clientes.csv"].includes("'+52 55 0000 1111"), "B-1: teléfono con '+' neutralizado");
    ok(A["oportunidades.csv"].includes("'@Oportunidad"), "B-1: nombre de oportunidad con '@' neutralizado");
    ok(A["oportunidades.csv"].includes("'-Comentario con guion inicial"), "B-1: comentario con '-' neutralizado");
    // El campo con coma+comillas va citado y con comillas dobladas (RFC 4180)
    ok(/"'@Oportunidad, QA ""fx"""/.test(A["oportunidades.csv"]), "B-1: coma y comillas escapadas (RFC 4180)");
    // El monto negativo REAL (number) NO se prefija con apóstrofo
    ok(/(^|,)-500(,|\r|$)/m.test(A["oportunidades.csv"]), "B-1: monto -500 (number) intacto, sin apóstrofo");

    // B-2: campos antes omitidos, comprobados POR COLUMNA (OBS-4).
    const fOpo = filaPorCelda(A["oportunidades.csv"], "Nombre", "@Oportunidad");
    ok(fOpo != null, "B-2: se localiza la fila de la oportunidad QA por su columna Nombre");
    ok(fOpo && fOpo["Comentarios"].includes("-Comentario con guion inicial"),
      "B-2: columna Comentarios = el comentario capturado");
    ok(fOpo && fOpo["Actualizada por"] === "Marta Ruiz",
      "B-2: columna 'Actualizada por' = Marta Ruiz exactamente (no confundida con Responsable)");
    const fRec = filaPorCelda(A["recordatorios.csv"], "Título", "QA-fx recordatorio");
    ok(fRec != null, "B-2: se localiza la fila del recordatorio QA por su columna Título");
    ok(fRec && fRec["Oportunidad"].includes("@Oportunidad"), "B-2: columna Oportunidad = la vinculada");
    ok(fRec && /^\d{4}-\d\d-\d\d/.test(fRec["Fecha fin"]), "B-2: columna 'Fecha fin' con fecha (no la de Fecha)");
    ok(fRec && fRec["Día de recurrencia"] === "15", "B-2: columna 'Día de recurrencia' = 15");
  } catch (e) {
    // OBS-7: una excepción se registra como FAIL; el flujo sigue al reporte.
    ok(false, `excepción no controlada: ${String(e).slice(0, 200)}`);
  } finally {
    // Limpieza: borra la oportunidad, envía el cliente QA a papelera y lo purga.
    // El resultado se registra (un fallo cuenta como FAIL, lección OBS-2 JUA-125).
    let limpio = true;
    try { if (oportunidadId) run("oportunidades:eliminar", { token: T, oportunidadId }); } catch (e) { limpio = false; console.error("cleanup opo:", String(e).slice(0, 120)); }
    try {
      if (clienteId) {
        run("clientes:enviarAPapelera", { token: T, clienteId });
        run("clientes:eliminarDefinitivo", { token: T, clienteId });
      }
    } catch (e) { limpio = false; console.error("cleanup cliente:", String(e).slice(0, 120)); }
    ok(limpio, "cleanup: fixtures QA eliminados");
    try { run("auth:cerrarSesion", { token: T }); } catch {}
  }

  fs.writeFileSync(REPORTE, [
    "Reporte driver-17 export fixtures (JUA-44 remediación B-1/B-2)",
    `fecha: ${new Date().toISOString()}`, `entorno: ${PROD.length ? "prod" : "dev"}`,
    `resultado: ${fallos.length === 0 ? "OK" : "CON FALLOS"} (${resultados.filter((r) => r.startsWith("PASS")).length} PASS / ${fallos.length} FAIL)`,
    "sin tokens ni contraseñas; fixtures QA eliminados al terminar.", "",
    ...resultados,
  ].join("\n") + "\n");
  console.log(`\nReporte en ${REPORTE}`);
  process.exit(fallos.length ? 1 : 0);
})();
