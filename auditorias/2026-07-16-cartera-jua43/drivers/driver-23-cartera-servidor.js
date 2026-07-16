// Driver 23 — JUA-43 remediación NO-GO (B-1..B-5). Negativas de servidor con dos
// operativos y un cliente ajeno + migración de seguimientos al reasignar cartera.
// Reporte durable sanitizado. try/finally.
// Uso: ADMIN_PASS=.. CARLOS_PASS=.. V2_PASS=.. node driver-23-cartera-servidor.js [reporte]
const { execFileSync } = require("child_process");
const fs = require("fs");

const CWD = process.env.REPO_DIR || "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM";
const REPORTE = process.argv.find((a) => a.endsWith(".txt")) || "/tmp/reporte-cartera-servidor.txt";
const AP = process.env.ADMIN_PASS, CP = process.env.CARLOS_PASS, VP = process.env.V2_PASS;

function run(fn, args) {
  const out = execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)],
    { cwd: CWD, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (out === "") return null; // Convex imprime null/void como salida vacía
  try { return JSON.parse(out); } catch { return out; }
}
function err(fn, args) {
  try { run(fn, args); return ""; }
  catch (e) { const s = String(e.stderr || e.message || e); return (s.match(/No encontrado|No autorizado|Responsable no válido/) || [""])[0]; }
}

(async () => {
  if (!AP || !CP || !VP) throw new Error("Faltan ADMIN_PASS / CARLOS_PASS / V2_PASS");
  const resultados = [], fallos = [];
  const ok = (c, m) => { const l = `${c ? "PASS" : "FAIL"} — ${m}`; console.log(l); resultados.push(l); if (!c) fallos.push(m); };
  const bloqueado = (x) => x === "No encontrado" || x === "No autorizado"; // cualquiera de las dos puertas rechaza sin filtrar datos

  const TA = run("auth:iniciarSesion", { email: "marta@demo.mx", password: AP }).token;
  const TC = run("auth:iniciarSesion", { email: "carlos@demo.mx", password: CP }).token;
  const TV = run("auth:iniciarSesion", { email: "vendedor2.qa@test.mx", password: VP }).token;
  const carlosId = run("auth:sesionActual", { token: TC }).usuario._id;
  const v2Id = run("auth:sesionActual", { token: TV }).usuario._id;

  // Fixtures declarados fuera del try para que la limpieza corra aunque falle la
  // preparación (obs. OBS-3): toda la creación va DENTRO del try/finally.
  let cid, oid, sid, cidPropio;

  try {
    // Fixture: un cliente de Carlos con una oportunidad y un seguimiento de cliente,
    // que luego Marta reasigna a vendedor2.
    cid = run("clientes:crear", { token: TC, nombre: "QA-cartera fx", telefono: "55 0000 9999", email: "qa-cartera@test.mx" });
    oid = run("oportunidades:crear", { token: TC, clienteId: cid, nombre: "Opo QA-cartera" });
    sid = run("seguimientos:crear", { token: TC, clienteId: cid, titulo: "Seg QA-cartera", fecha: 1786000000000, prioridad: "media" });
    run("clientes:asignarResponsable", { token: TA, clienteId: cid, responsableId: v2Id }); // ahora es de vendedor2

    // B-1: Carlos cambia etapa de una oportunidad de un cliente ajeno → rechazo
    ok(err("oportunidades:cambiarEtapa", { token: TC, oportunidadId: oid, etapa: "ganada" }) === "No encontrado",
      "B-1: cambiarEtapa de oportunidad ajena → No encontrado");
    const opoDespues = run("clientes:detalle", { token: TA, clienteId: cid }).oportunidades.find((o) => o._id === oid);
    ok(opoDespues && opoDespues.etapa === "nueva", "B-1: la etapa de la oportunidad NO cambió (sigue 'nueva')");

    // B-2a: Carlos (dueño ANTERIOR) ya no gestiona el seguimiento del cliente ajeno → rechazo
    // (tras migrar, el seguimiento ya no es suyo: lo frena la puerta de responsable/cartera).
    ok(bloqueado(err("seguimientos:reprogramar", { token: TC, seguimientoId: sid, fecha: 1787000000000 })),
      "B-2a: Carlos reprograma seguimiento de cliente ajeno → bloqueado");
    ok(bloqueado(err("inicio:marcarSeguimientoRealizado", { token: TC, seguimientoId: sid })),
      "B-2a: Carlos marcaRealizado de cliente ajeno → bloqueado");
    ok(bloqueado(err("seguimientos:eliminar", { token: TC, seguimientoId: sid })),
      "B-2a: Carlos elimina seguimiento de cliente ajeno → bloqueado");

    // B-2b: MIGRACIÓN — vendedor2 (nuevo dueño de la cartera) heredó el seguimiento y SÍ lo gestiona
    ok(err("seguimientos:reprogramar", { token: TV, seguimientoId: sid, fecha: 1787000000000 }) === "",
      "B-2b: vendedor2 (nuevo dueño) reprograma el seguimiento migrado → OK");
    ok(err("seguimientos:cancelar", { token: TV, seguimientoId: sid }) === "",
      "B-2b: vendedor2 (nuevo dueño) cancela el seguimiento migrado → OK");

    // B-2c: DEFENSA EN PROFUNDIDAD — admin delega a Carlos un seguimiento de un cliente que NO es
    // su cartera; Carlos es el responsable pero igual queda bloqueado por la cartera.
    const sidDeleg = run("seguimientos:crear", { token: TA, clienteId: cid, responsableId: carlosId, titulo: "Seg delegado QA", fecha: 1786500000000, prioridad: "media" });
    ok(err("seguimientos:cancelar", { token: TC, seguimientoId: sidDeleg }) === "No encontrado",
      "B-2c: Carlos (responsable) NO gestiona seguimiento de cliente ajeno → bloqueado por cartera");
    ok(err("inicio:marcarSeguimientoRealizado", { token: TC, seguimientoId: sidDeleg }) === "No encontrado",
      "B-2c: Carlos marcaRealizado del delegado ajeno → bloqueado por cartera");

    // B-3 (aislamiento): Carlos sincroniza inactividad → no toca clientes ajenos. Snapshot de los de vendedor2.
    const estadoDe = (t, id) => (run("clientes:listar", { token: t }).find((c) => c._id === id) || {}).estado;
    const snap = (t) => JSON.stringify(run("clientes:listar", { token: t }).map((c) => [c._id, c.estado]).sort());
    const antesV2 = snap(TV);
    const sync = run("clientes:sincronizarInactividad", { token: TC });
    ok(snap(TV) === antesV2, `B-3: sincronizar (Carlos) NO cambia estados de la cartera de vendedor2 (cambiados=${sync.cambiados})`);

    // B-3 (positivo, obs. OBS-3): un cliente PROPIO de Carlos en "prospecto" y recién
    // interactuado ENTRA en la evaluación de su cartera pero NO se transiciona (regla de
    // 15 días). Así se prueba que el filtro por cartera INCLUYE a los propios y la lógica
    // de transición sigue viva, sin desactivarse. NOTA: una transición POSITIVA a
    // "inactivo" 100% determinista exigiría antedatar `ultimaInteraccion`/creación, que
    // no es posible por API pública (solo mutación interna); queda documentada la limitación.
    cidPropio = run("clientes:crear", { token: TC, nombre: "QA-propio fx", telefono: "55 0000 8888", email: "" });
    run("clientes:cambiarEstado", { token: TC, clienteId: cidPropio, estado: "prospecto" });
    const syncPropio = run("clientes:sincronizarInactividad", { token: TC });
    ok(estadoDe(TC, cidPropio) === "prospecto" && typeof syncPropio.cambiados === "number",
      `B-3+: la sincronización de Carlos evalúa su cartera sin transicionar a un cliente propio recién activo (estado=${estadoDe(TC, cidPropio)}, cambiados=${syncPropio.cambiados})`);

    // B-4: buscarDuplicado con el tel del cliente ajeno → Carlos no recibe datos (null)
    const dupCarlos = run("clientes:buscarDuplicado", { token: TC, telefono: "55 0000 9999", email: "" });
    ok(dupCarlos === null, "B-4: buscarDuplicado de un cliente ajeno → null para Carlos (sin datos)");
    const dupV2 = run("clientes:buscarDuplicado", { token: TV, telefono: "55 0000 9999", email: "" });
    ok(dupV2 && dupV2.nombre === "QA-cartera fx", "B-4: vendedor2 (dueño) SÍ ve su propio duplicado");

    // B-5: estadoGlobal — el total de Carlos no incluye el cliente ajeno; admin ve más
    const totalCarlos = run("inicio:estadoGlobal", { token: TC }).total;
    const totalAdmin = run("inicio:estadoGlobal", { token: TA }).total;
    ok(totalCarlos < totalAdmin, `B-5: estadoGlobal de Carlos (${totalCarlos}) < admin (${totalAdmin}) — solo su cartera`);
  } catch (e) {
    ok(false, `excepción: ${String(e).slice(0, 200)}`);
  } finally {
    // Limpieza (corre aunque falle la preparación): borra oportunidad y clientes QA
    // como admin. El borrado del cliente arrastra en cascada sus seguimientos.
    if (oid) { try { run("oportunidades:eliminar", { token: TA, oportunidadId: oid }); } catch {} }
    for (const id of [cid, cidPropio]) {
      if (!id) continue;
      try { run("clientes:enviarAPapelera", { token: TA, clienteId: id }); run("clientes:eliminarDefinitivo", { token: TA, clienteId: id }); } catch {}
    }
    for (const t of [TA, TC, TV]) { try { run("auth:cerrarSesion", { token: t }); } catch {} }
  }

  fs.writeFileSync(REPORTE, [
    "Reporte driver-23 cartera negativas de servidor (JUA-43, remediación B-1..B-5)",
    `fecha: ${new Date().toISOString()}`,
    `resultado: ${fallos.length === 0 ? "OK" : "CON FALLOS"} (${resultados.filter((r) => r.startsWith("PASS")).length} PASS / ${fallos.length} FAIL)`,
    "sin tokens ni contraseñas; fixtures QA eliminados.", "", ...resultados,
  ].join("\n") + "\n");
  console.log(`\nReporte en ${REPORTE}`);
  process.exit(fallos.length ? 1 : 0);
})();
