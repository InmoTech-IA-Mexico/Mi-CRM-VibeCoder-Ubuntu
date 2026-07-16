// Driver 26 — JUA-38 fuente de contacto (negativas de servidor, obs. OBS-2 del dictamen v1).
// Verifica por invocación directa la validación NUEVA + los guards heredados en clientes.actualizar:
//  1) detalle sin tipo → no se guarda      2) detalle > 120 → recortado a 120
//  3) tipo inválido → rechazado            4) observador → rechazado (JUA-42)
//  5) operativo sobre cliente ajeno → rechazado por cartera (JUA-43)
// Crea (y limpia) un observador QA y clientes QA. Reporte sanitizado. try/finally.
// Uso: ADMIN_PASS=.. CARLOS_PASS=.. V2_PASS=.. node driver-26-fuente-servidor.js [reporte.txt]
const { execFileSync } = require("child_process");
const fs = require("fs");

const CWD = process.env.REPO_DIR || "/home/juan/Juan/Proyecto aprendizaje/Vibe CRM";
const REPORTE = process.argv.find((a) => a.endsWith(".txt")) || "/tmp/reporte-fuente-servidor.txt";
const AP = process.env.ADMIN_PASS, CP = process.env.CARLOS_PASS, VP = process.env.V2_PASS;

const PROD = process.env.PROD === "1"; // apuntar a producción (glad-bird-297)
function run(fn, args) {
  const argv = ["convex", "run", ...(PROD ? ["--prod"] : []), fn, JSON.stringify(args)];
  const out = execFileSync("npx", argv,
    { cwd: CWD, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (out === "") return null;
  try { return JSON.parse(out); } catch { return out; }
}
function err(fn, args) {
  try { run(fn, args); return ""; }
  catch (e) { const s = String(e.stderr || e.message || e); return (s.match(/No encontrado|No autorizado|Responsable no válido/) || [""])[0]; }
}
function lanza(fn, args) { try { run(fn, args); return false; } catch { return true; } }

// Args base válidos para actualizar (nombre + al menos tel/email + prioridad).
const base = (token, clienteId, nombre) => ({ token, clienteId, nombre, telefono: "55 0000 1234", email: "", empresa: "", prioridad: "media" });

(async () => {
  // En prod (verificación en vivo) solo se ejercita la lógica NUEVA (casos 1-3) con
  // Marta: el observador y la cartera son guards heredados (JUA-42/43), ya probados en
  // vivo y aquí en dev. En dev se cubren los 5 casos (requiere CARLOS_PASS/V2_PASS).
  if (!AP || (!PROD && (!CP || !VP))) throw new Error("Faltan credenciales (ADMIN_PASS; en dev además CARLOS_PASS/V2_PASS)");
  const resultados = [], fallos = [];
  const ok = (c, m) => { const l = `${c ? "PASS" : "FAIL"} — ${m}`; console.log(l); resultados.push(l); if (!c) fallos.push(m); };

  const TA = run("auth:iniciarSesion", { email: "marta@demo.mx", password: AP }).token;
  const TC = PROD ? null : run("auth:iniciarSesion", { email: "carlos@demo.mx", password: CP }).token;
  const TV = PROD ? null : run("auth:iniciarSesion", { email: "vendedor2.qa@test.mx", password: VP }).token;
  const v2Id = PROD ? null : run("auth:sesionActual", { token: TV }).usuario._id;

  let cidAdmin, cidCarlos, obsId, TO;
  const obsEmail = `qa-obs-fuente-${Date.now()}@test.mx`;
  try {
    if (!PROD) {
      // Observador QA (para la negativa de solo-lectura, JUA-42)
      run("usuarios:invitar", { token: TA, email: obsEmail, nombre: "QA Obs Fuente", rol: "observador" });
      const inv = run("usuarios:listar", { token: TA }).invitaciones.find((i) => i.email === obsEmail && i.estado === "pendiente");
      run("invitaciones:activar", { token: inv.token, password: "ObsQaFuente123" });
      TO = run("auth:iniciarSesion", { email: obsEmail, password: "ObsQaFuente123" }).token;
      obsId = run("auth:sesionActual", { token: TO }).usuario._id;
      cidCarlos = run("clientes:crear", { token: TC, nombre: "QA-fuente carlos", telefono: "55 0000 5678", email: "" });
      run("clientes:asignarResponsable", { token: TA, clienteId: cidCarlos, responsableId: v2Id }); // ajeno para Carlos
    }
    cidAdmin = run("clientes:crear", { token: TA, nombre: "QA-fuente admin", telefono: "55 0000 1234", email: "" });

    // 1) Detalle sin tipo → NO se guarda
    run("clientes:actualizar", { ...base(TA, cidAdmin, "QA-fuente admin"), fuenteDetalle: "detalle sin categoría" });
    const d1 = run("clientes:detalle", { token: TA, clienteId: cidAdmin });
    ok(d1.fuenteTipo === null && d1.fuenteDetalle === null, "1: detalle sin tipo → no se guarda (tipo y detalle quedan null)");

    // 2) Detalle > 120 → recortado a 120
    run("clientes:actualizar", { ...base(TA, cidAdmin, "QA-fuente admin"), fuenteTipo: "campana", fuenteDetalle: "A".repeat(200) });
    const d2 = run("clientes:detalle", { token: TA, clienteId: cidAdmin });
    ok(d2.fuenteTipo === "campana" && d2.fuenteDetalle && d2.fuenteDetalle.length === 120,
      `2: detalle > 120 → recortado a 120 (len=${d2.fuenteDetalle ? d2.fuenteDetalle.length : "null"})`);

    // 3) Tipo inválido → rechazado por el validador de Convex
    ok(lanza("clientes:actualizar", { ...base(TA, cidAdmin, "QA-fuente admin"), fuenteTipo: "invalido" }),
      "3: tipo de fuente inválido → rechazado (ArgumentValidationError)");
    // …y el dato válido previo no cambió
    const d3 = run("clientes:detalle", { token: TA, clienteId: cidAdmin });
    ok(d3.fuenteTipo === "campana", "3: tras el rechazo, la fuente válida previa se mantiene");

    if (!PROD) {
      // 4) Observador → rechazado (solo lectura, JUA-42)
      ok(err("clientes:actualizar", { ...base(TO, cidAdmin, "QA-fuente admin"), fuenteTipo: "referido" }) === "No autorizado",
        "4: observador no puede fijar la fuente → No autorizado");

      // 5) Operativo sobre cliente ajeno → rechazado por cartera (JUA-43)
      ok(err("clientes:actualizar", { ...base(TC, cidCarlos, "QA-fuente carlos"), fuenteTipo: "evento" }) === "No encontrado",
        "5: operativo fija la fuente de un cliente ajeno → No encontrado (cartera)");
    }
  } catch (e) {
    ok(false, `excepción: ${String(e).slice(0, 200)}`);
  } finally {
    for (const id of [cidAdmin, cidCarlos]) {
      if (!id) continue;
      try { run("clientes:enviarAPapelera", { token: TA, clienteId: id }); run("clientes:eliminarDefinitivo", { token: TA, clienteId: id }); } catch {}
    }
    if (obsId) { try { run("usuarios:desactivar", { token: TA, usuarioId: obsId }); } catch {} }
    for (const t of [TA, TC, TV, TO]) { if (t) { try { run("auth:cerrarSesion", { token: t }); } catch {} } }
  }

  fs.writeFileSync(REPORTE, [
    "Reporte driver-26 fuente de contacto — negativas de servidor (JUA-38, obs. OBS-2)",
    `fecha: ${new Date().toISOString()}`,
    `resultado: ${fallos.length === 0 ? "OK" : "CON FALLOS"} (${resultados.filter((r) => r.startsWith("PASS")).length} PASS / ${fallos.length} FAIL)`,
    "observador y clientes QA creados y limpiados; sin tokens ni contraseñas.", "", ...resultados,
  ].join("\n") + "\n");
  console.log(`\nReporte en ${REPORTE}`);
  process.exit(fallos.length ? 1 : 0);
})();
