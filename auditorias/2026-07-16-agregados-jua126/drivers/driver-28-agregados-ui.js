// Driver 28 — JUA-126 remediación B-1 (UI). Verifica que el flujo operativo de tarea
// personal NO muestre "null clientes" y que el admin sí vea la carga por miembro.
// Credenciales por env. Vigila pageerror/console.error. try/finally.
// Uso: ADMIN_PASS=.. CARLOS_PASS=.. node driver-28-agregados-ui.js [reporte.txt]
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const REPORTE = process.argv.find((a) => a.endsWith(".txt")) || `${SHOTS}/reporte-agregados-ui.txt`;
const ADMIN = { email: process.env.ADMIN_EMAIL || "marta@demo.mx", pass: process.env.ADMIN_PASS, rol: "admin" };
const CARLOS = { email: process.env.CARLOS_EMAIL || "carlos@demo.mx", pass: process.env.CARLOS_PASS, rol: "operativo" };

(async () => {
  for (const u of [ADMIN, CARLOS]) if (!u.pass) throw new Error(`Falta contraseña de ${u.email}`);
  const browser = await chromium.launch();
  const resultados = [], fallos = [], errNav = [];
  const ok = (c, m) => { const l = `${c ? "PASS" : "FAIL"} — ${m}`; console.log(l); resultados.push(l); if (!c) fallos.push(m); };
  const vis = (loc, t = 12000) => loc.waitFor({ state: "visible", timeout: t }).then(() => true).catch(() => false);
  const login = async (u) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errNav.push(`[${u.rol}] pageerror: ${String(e).slice(0, 160)}`));
    page.on("console", (m) => { if (m.type() === "error") errNav.push(`[${u.rol}] console.error: ${m.text().slice(0, 160)}`); });
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder("nombre@empresa.mx").fill(u.email);
    await page.getByPlaceholder("••••••••").fill(u.pass);
    await page.getByRole("button", { name: /Entrar/i }).click();
    await page.waitForURL("**/inicio", { timeout: 20000 });
    return { ctx, page };
  };

  let cA, cC;
  try {
    // A) Operativo (Carlos): tarea personal → la tarjeta de empleado NO muestra "null"
    ({ ctx: cC } = await login(CARLOS));
    const pc = (await cC.pages())[0];
    await pc.goto(`${BASE}/seguimientos/nuevo`);
    await vis(pc.getByRole("button", { name: "Empleado" }));
    await pc.getByRole("button", { name: "Empleado" }).click();
    // La tarjeta muestra a Carlos (él mismo) con su rol; sin "null".
    ok(await vis(pc.getByText("Operativo").first()), "A: operativo — la tarjeta de empleado muestra el rol (Operativo)");
    ok(!(await pc.getByText(/null/i).first().isVisible().catch(() => false)),
      "A: operativo — la tarjeta NO muestra 'null' (B-1 corregido)");
    await pc.screenshot({ path: `${SHOTS}/d28-operativo-empleado.png` });

    // B) Admin (Marta): al elegir empleado, la hoja lista miembros CON su carga numérica
    ({ ctx: cA } = await login(ADMIN));
    const pa = (await cA.pages())[0];
    await pa.goto(`${BASE}/seguimientos/nuevo`);
    await vis(pa.getByRole("button", { name: "Empleado" }));
    await pa.getByRole("button", { name: "Empleado" }).click();
    await pa.getByText("Selecciona un empleado").click(); // abre la hoja (solo admin)
    // En la hoja, algún miembro muestra "N cliente(s)"; y no hay "null".
    ok(await vis(pa.getByText(/\d+\s+cliente/i).first()), "B: admin — la hoja de empleados muestra la carga (N clientes)");
    ok(!(await pa.getByText(/·\s*null/i).first().isVisible().catch(() => false)),
      "B: admin — sin 'null' en las cargas");
    await pa.screenshot({ path: `${SHOTS}/d28-admin-hoja.png` });

    ok(errNav.length === 0, `sin errores de navegador${errNav.length ? " — " + errNav.join(" | ") : ""}`);
  } catch (e) {
    ok(false, `excepción: ${String(e).slice(0, 200)}`);
  } finally {
    for (const c of [cA, cC]) { if (c) { try { await c.close(); } catch {} } }
    await browser.close();
  }

  fs.writeFileSync(REPORTE, [
    "Reporte driver-28 remediación B-1 fuente/agregados (JUA-126, UI)",
    `fecha: ${new Date().toISOString()}`,
    `baseUrl: ${BASE}`,
    `resultado: ${fallos.length === 0 ? "OK" : "CON FALLOS"} (${resultados.filter((r) => r.startsWith("PASS")).length} PASS / ${fallos.length} FAIL)`,
    `errores navegador: ${errNav.length}`,
    "", ...resultados,
  ].join("\n") + "\n");
  console.log(`\nReporte en ${REPORTE}`);
  process.exit(fallos.length ? 1 : 0);
})();
