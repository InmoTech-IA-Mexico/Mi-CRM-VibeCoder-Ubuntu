// Driver 21 — JUA-42 negativas de servidor del rol Observador (remediación NO-GO v1).
// Verifica que las 15 mutaciones que ESCRIBEN datos del negocio rechazan al
// observador, con lectura positiva de contraste, y que sincronizarInactividad
// (B-1) no produce cambios. Reporte durable sanitizado (sin tokens/contraseñas).
// Usa `npx convex run`. Uso: OBS_PASS=.. ADMIN_PASS=.. node driver-21-... [reporte] [--prod]
const { execFileSync } = require("child_process");
const fs = require("fs");

const CWD = process.env.REPO_DIR || "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM";
const PROD = process.argv.includes("--prod") ? ["--prod"] : [];
const REPORTE = process.argv.find((a) => a.endsWith(".txt")) || "/tmp/reporte-obs-servidor.txt";
const OBS_EMAIL = process.env.OBS_EMAIL || "observador.qa@test.mx";
const OBS_PASS = process.env.OBS_PASS;
const ADMIN_PASS = process.env.ADMIN_PASS;

function run(fn, args) {
  const out = execFileSync("npx", ["convex", "run", ...PROD, fn, JSON.stringify(args)],
    { cwd: CWD, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try { return { ok: true, val: JSON.parse(out) }; } catch { return { ok: true, val: out }; }
}
function runErr(fn, args) {
  try { const r = run(fn, args); return { rechazado: false, val: r.val }; }
  catch (e) {
    const s = String(e.stderr || e.message || e);
    return { rechazado: /No autorizado|Solo el administrador/.test(s), msg: (s.match(/No autorizado|Solo el administrador[^\\"']*/) || [""])[0] };
  }
}
/** Ejecuta y devuelve el mensaje de error del servidor (o "" si no falló). */
function mensajeError(fn, args) {
  try { run(fn, args); return ""; }
  catch (e) { const s = String(e.stderr || e.message || e); return (s.match(/[A-ZÁÉ][^\n"]*no válid[oa]|No autorizado/) || [""])[0]; }
}

(async () => {
  if (!OBS_PASS || !ADMIN_PASS) throw new Error("Faltan OBS_PASS / ADMIN_PASS");
  const resultados = [];
  const fallos = [];
  const ok = (c, m) => { const l = `${c ? "PASS" : "FAIL"} — ${m}`; console.log(l); resultados.push(l); if (!c) fallos.push(m); };
  const sesiones = [];
  const OBS_ID = process.env.OBS_ID; // id del usuario observador (para OBS-7)

  try {
  const S = run("auth:iniciarSesion", { email: OBS_EMAIL, password: OBS_PASS }).val.token; sesiones.push(S);
  const TA = run("auth:iniciarSesion", { email: "marta@demo.mx", password: ADMIN_PASS }).val.token; sesiones.push(TA);
  // ids reales del negocio (vía sesión admin para no depender del formato de `data`)
  const lista = run("clientes:listar", { token: TA }).val;
  const CID = lista[0]._id;
  const OID = (run("clientes:detalle", { token: TA, clienteId: CID }).val.oportunidades[0] || {})._id;
  const SEG = (run("clientes:detalle", { token: TA, clienteId: CID }).val.seguimientos[0] || {})._id;

  // Lectura positiva de contraste
  ok(Array.isArray(run("clientes:listar", { token: S }).val), "lectura: clientes.listar funciona para el observador");
  ok(run("clientes:detalle", { token: S, clienteId: CID }).val?.nombre != null, "lectura: clientes.detalle funciona");

  // 15 escrituras de datos del negocio → rechazo
  const casos = [
    ["clientes:crear", { token: S, nombre: "Hack", telefono: "55", email: "h@x.mx" }],
    ["clientes:actualizar", { token: S, clienteId: CID, nombre: "X", telefono: "55", email: "", empresa: "", prioridad: "alta" }],
    ["clientes:cambiarEstado", { token: S, clienteId: CID, estado: "activo" }],
    ["clientes:cambiarPrioridad", { token: S, clienteId: CID, prioridad: "alta" }],
    ["clientes:cambiarEtiquetas", { token: S, clienteId: CID, etiquetaIds: [] }],
    ["notas:crear", { token: S, clienteId: CID, tipo: "llamada", descripcion: "hack" }],
    ["oportunidades:crear", { token: S, clienteId: CID, nombre: "Hack" }],
    ["oportunidades:cambiarEtapa", { token: S, oportunidadId: OID, etapa: "ganada" }],
    ["ventas:crear", { token: S, clienteId: CID, importe: 100, fecha: 1786000000000 }],
    ["seguimientos:crear", { token: S, clienteId: CID, titulo: "Hack", fecha: 1786000000000, prioridad: "media" }],
    ["seguimientos:reprogramar", { token: S, seguimientoId: SEG, fecha: 1786000000000 }],
    ["seguimientos:cancelar", { token: S, seguimientoId: SEG }],
    ["seguimientos:eliminar", { token: S, seguimientoId: SEG }],
    ["inicio:marcarSeguimientoRealizado", { token: S, seguimientoId: SEG }],
  ];
  for (const [fn, args] of casos) {
    const r = runErr(fn, args);
    ok(r.rechazado, `escritura ${fn} → rechazada (${r.msg || "sin rechazo"})`);
  }

  // B-1: sincronizarInactividad no escribe para el observador. Snapshot antes/después.
  const antes = JSON.stringify(run("clientes:listar", { token: TA }).val.map((c) => [c._id, c.estado]));
  const sync = run("clientes:sincronizarInactividad", { token: S }).val;
  const despues = JSON.stringify(run("clientes:listar", { token: TA }).val.map((c) => [c._id, c.estado]));
  ok(sync && sync.cambiados === 0, `B-1: sincronizarInactividad para observador → cambiados=0 (${sync?.cambiados})`);
  ok(antes === despues, "B-1: los estados de los clientes NO cambian tras la llamada del observador");

  // OBS-4: el admin SÍ puede sincronizar (contraste positivo; el resultado es un contador ≥ 0).
  const syncAdmin = run("clientes:sincronizarInactividad", { token: TA }).val;
  ok(syncAdmin && typeof syncAdmin.cambiados === "number", `OBS-4: el admin sincroniza con normalidad (cambiados=${syncAdmin?.cambiados})`);

  // OBS-7: negativa dinámica de OBS-1 — el admin NO puede asignar un seguimiento al observador.
  if (OBS_ID) {
    const mResp = mensajeError("seguimientos:crear", { token: TA, clienteId: CID, titulo: "QA-obs resp", fecha: 1786000000000, prioridad: "media", responsableId: OBS_ID });
    ok(/Responsable no válido/.test(mResp), `OBS-7: asignar observador como responsable → rechazado (${mResp || "SIN RECHAZO"})`);
    const mEmp = mensajeError("seguimientos:crear", { token: TA, destino: "empleado", empleadoId: OBS_ID, titulo: "QA-obs emp", fecha: 1786000000000, prioridad: "media" });
    ok(/Empleado no válido/.test(mEmp), `OBS-7: asignar observador como empleado destino → rechazado (${mEmp || "SIN RECHAZO"})`);
  }
  } catch (e) {
    ok(false, `excepción no controlada: ${String(e).slice(0, 200)}`);
  } finally {
    // OBS-5: cerrar sesiones pase lo que pase.
    for (const t of sesiones) { try { run("auth:cerrarSesion", { token: t }); } catch {} }
    fs.writeFileSync(REPORTE, [
      "Reporte driver-21 negativas de servidor Observador (JUA-42, remediación B-1)",
      `fecha: ${new Date().toISOString()}`, `entorno: ${PROD.length ? "prod" : "dev"}`,
      `resultado: ${fallos.length === 0 ? "OK" : "CON FALLOS"} (${resultados.filter((r) => r.startsWith("PASS")).length} PASS / ${fallos.length} FAIL)`,
      "sin tokens ni contraseñas.", "", ...resultados,
    ].join("\n") + "\n");
    console.log(`\nReporte en ${REPORTE}`);
  }
  process.exit(fallos.length ? 1 : 0);
})();
