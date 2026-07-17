// Driver 27 — JUA-126 visibilidad de agregados por cartera (negativas de servidor).
//  A) usuarios.equipo: operativo Y observador reciben la lista SIN carga (clientes=null); admin SÍ.
//  B) etiquetas.listar: el conteo por etiqueta se limita a la cartera del operativo; admin ve todo.
// Crea y limpia un observador QA + una etiqueta + 2 clientes. Toda la preparación va DENTRO del
// try/finally (obs. OBS-1). Reporte sanitizado. Uso: ADMIN_PASS/CARLOS_PASS/V2_PASS por env.
const { execFileSync } = require("child_process");
const fs = require("fs");

const CWD = process.env.REPO_DIR || "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM";
const REPORTE = process.argv.find((a) => a.endsWith(".txt")) || "/tmp/reporte-agregados.txt";
const AP = process.env.ADMIN_PASS, CP = process.env.CARLOS_PASS, VP = process.env.V2_PASS;

function run(fn, args) {
  const out = execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)],
    { cwd: CWD, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (out === "") return null;
  try { return JSON.parse(out); } catch { return out; }
}

(async () => {
  if (!AP || !CP || !VP) throw new Error("Faltan ADMIN_PASS / CARLOS_PASS / V2_PASS");
  const resultados = [], fallos = [];
  const ok = (c, m) => { const l = `${c ? "PASS" : "FAIL"} — ${m}`; console.log(l); resultados.push(l); if (!c) fallos.push(m); };

  // Todo declarado fuera del try para que la limpieza corra aunque falle la preparación (OBS-1).
  let TA, TC, TV, TO, v2Id, obsId, cidA, cidB, tagId;
  const obsEmail = `qa-obs-126-${Date.now()}@test.mx`;
  try {
    TA = run("auth:iniciarSesion", { email: "marta@demo.mx", password: AP }).token;
    TC = run("auth:iniciarSesion", { email: "carlos@demo.mx", password: CP }).token;
    TV = run("auth:iniciarSesion", { email: "vendedor2.qa@test.mx", password: VP }).token;
    v2Id = run("auth:sesionActual", { token: TV }).usuario._id;

    // Observador QA (para la aserción de solo-lectura sin carga, OBS-2)
    run("usuarios:invitar", { token: TA, email: obsEmail, nombre: "QA Obs 126", rol: "observador" });
    const inv = run("usuarios:listar", { token: TA }).invitaciones.find((i) => i.email === obsEmail && i.estado === "pendiente");
    run("invitaciones:activar", { token: inv.token, password: "ObsQa126seguro" });
    TO = run("auth:iniciarSesion", { email: obsEmail, password: "ObsQa126seguro" }).token;
    obsId = run("auth:sesionActual", { token: TO }).usuario._id;

    // A) usuarios.equipo — carga solo para admin
    const eqC = run("usuarios:equipo", { token: TC });
    ok(eqC.soyAdmin === false && eqC.usuarios.length > 0 && eqC.usuarios.every((u) => u.clientes === null),
      "A: equipo del operativo → lista con nombres/roles pero SIN carga (clientes=null en todos)");
    const eqO = run("usuarios:equipo", { token: TO });
    ok(eqO.soyAdmin === false && eqO.usuarios.every((u) => u.clientes === null),
      "A: equipo del observador → también SIN carga (clientes=null) [OBS-2]");
    const eqA = run("usuarios:equipo", { token: TA });
    ok(eqA.soyAdmin === true && eqA.usuarios.some((u) => typeof u.clientes === "number"),
      "A: equipo del admin → SÍ incluye la carga por miembro (numérica)");

    // B) etiquetas.listar — conteo por cartera. Etiqueta en un cliente propio + uno ajeno.
    tagId = run("etiquetas:crear", { token: TA, nombre: "QA-126-" + Date.now() });
    cidA = run("clientes:crear", { token: TC, nombre: "QA-126 propio", telefono: "55 0000 2601", email: "" });
    cidB = run("clientes:crear", { token: TA, nombre: "QA-126 ajeno", telefono: "55 0000 2602", email: "" });
    run("clientes:asignarResponsable", { token: TA, clienteId: cidB, responsableId: v2Id }); // cartera de Vendedor Dos
    run("clientes:cambiarEtiquetas", { token: TC, clienteId: cidA, etiquetaIds: [tagId] });
    run("clientes:cambiarEtiquetas", { token: TA, clienteId: cidB, etiquetaIds: [tagId] });

    const cntC = (run("etiquetas:listar", { token: TC }).find((e) => e._id === tagId) || {}).clientes;
    const cntA = (run("etiquetas:listar", { token: TA }).find((e) => e._id === tagId) || {}).clientes;
    ok(cntC === 1, `B: el operativo cuenta solo su cartera para la etiqueta (${cntC} = 1)`);
    ok(cntA === 2, `B: el admin cuenta el negocio completo para la etiqueta (${cntA} = 2)`);
  } catch (e) {
    ok(false, `excepción: ${String(e).slice(0, 200)}`);
  } finally {
    if (TA) {
      for (const id of [cidA, cidB]) {
        if (!id) continue;
        try { run("clientes:enviarAPapelera", { token: TA, clienteId: id }); run("clientes:eliminarDefinitivo", { token: TA, clienteId: id }); } catch {}
      }
      if (tagId) { try { run("etiquetas:eliminar", { token: TA, etiquetaId: tagId }); } catch {} }
      if (obsId) { try { run("usuarios:desactivar", { token: TA, usuarioId: obsId }); } catch {} }
    }
    for (const t of [TA, TC, TV, TO]) { if (t) { try { run("auth:cerrarSesion", { token: t }); } catch {} } }
  }

  fs.writeFileSync(REPORTE, [
    "Reporte driver-27 visibilidad de agregados por cartera (JUA-126)",
    `fecha: ${new Date().toISOString()}`,
    `resultado: ${fallos.length === 0 ? "OK" : "CON FALLOS"} (${resultados.filter((r) => r.startsWith("PASS")).length} PASS / ${fallos.length} FAIL)`,
    "observador, etiqueta y clientes QA creados y limpiados; sin tokens ni contraseñas.", "", ...resultados,
  ].join("\n") + "\n");
  console.log(`\nReporte en ${REPORTE}`);
  process.exit(fallos.length ? 1 : 0);
})();
