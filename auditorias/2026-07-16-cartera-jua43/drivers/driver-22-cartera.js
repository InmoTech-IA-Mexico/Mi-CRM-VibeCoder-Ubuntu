// Driver 22 — JUA-43 cartera por vendedor (UI). Credenciales por env.
//  A) admin (Marta): toggle Todos/Mis clientes; ficha con selector de responsable;
//     reasigna Ana a Carlos y verifica.
//  B) vendedor2: ve Ana en su lista; NO ve un cliente ajeno; su ficha sin selector.
//  C) Carlos: tras la reasignación ve Ana; abre su ficha.
// Reporte durable; vigila pageerror/console.error. try/finally.
// Uso: ADMIN_PASS=.. V2_PASS=.. CARLOS_PASS=.. node driver-22-cartera.js <anaId> <carlosId>
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const REPORTE = process.argv[4] || `${SHOTS}/reporte-cartera.txt`;
const ANA = process.argv[2];
const CARLOS_ID = process.argv[3];
const ADMIN = { email: process.env.ADMIN_EMAIL || "marta@demo.mx", pass: process.env.ADMIN_PASS, rol: "admin" };
const V2 = { email: process.env.V2_EMAIL || "vendedor2.qa@test.mx", pass: process.env.V2_PASS, rol: "vendedor2" };
const CARLOS = { email: process.env.CARLOS_EMAIL || "carlos@demo.mx", pass: process.env.CARLOS_PASS, rol: "operativo" };

(async () => {
  for (const u of [ADMIN, V2, CARLOS]) if (!u.pass) throw new Error(`Falta contraseña de ${u.email}`);
  const browser = await chromium.launch();
  const resultados = [];
  const fallos = [];
  const errNav = [];
  const ok = (c, m) => { const l = `${c ? "PASS" : "FAIL"} — ${m}`; console.log(l); resultados.push(l); if (!c) fallos.push(m); };
  const vis = (loc, t = 12000) => loc.waitFor({ state: "visible", timeout: t }).then(() => true).catch(() => false);
  const vigilar = (page, rol) => {
    page.on("pageerror", (e) => errNav.push(`[${rol}] pageerror: ${String(e).slice(0, 160)}`));
    page.on("console", (m) => { if (m.type() === "error") errNav.push(`[${rol}] console.error: ${m.text().slice(0, 160)}`); });
  };
  const login = async (u) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    vigilar(page, u.rol);
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder("nombre@empresa.mx").fill(u.email);
    await page.getByPlaceholder("••••••••").fill(u.pass);
    await page.getByRole("button", { name: /Entrar/i }).click();
    await page.waitForURL("**/inicio", { timeout: 20000 });
    return { ctx, page };
  };
  const contarClientes = (page) => page.locator("a[href^='/clientes/j']").count();

  try {
    // A) Admin: toggle + ficha con selector de responsable
    const { ctx: cA, page: pa } = await login(ADMIN);
    await pa.goto(`${BASE}/clientes`);
    await pa.waitForTimeout(2000);
    const totalTodos = await contarClientes(pa);
    ok(totalTodos > 8, `A: admin en 'Todos' ve todos los clientes (${totalTodos})`);
    await pa.getByRole("button", { name: "Mis clientes" }).click();
    await pa.waitForTimeout(1500);
    const totalMios = await contarClientes(pa);
    ok(totalMios < totalTodos, `A: 'Mis clientes' reduce la lista (${totalMios} < ${totalTodos})`);
    await pa.screenshot({ path: `${SHOTS}/d22-toggle-admin.png` });

    // Ficha de Ana (asignada a vendedor2): admin ve el selector de responsable
    await pa.goto(`${BASE}/clientes/${ANA}`);
    await pa.waitForTimeout(2000);
    ok(await vis(pa.getByLabel("Cambiar responsable del cliente")), "A: la ficha muestra el selector de responsable (admin)");
    ok(await pa.getByText("Vendedor Dos").first().isVisible(), "A: el responsable actual de Ana es 'Vendedor Dos'");
    // Reasignar Ana a Carlos
    await pa.getByLabel("Cambiar responsable del cliente").click();
    await vis(pa.getByText("Responsable del cliente"));
    await pa.getByRole("button", { name: /Carlos Díaz/ }).click();
    await pa.waitForTimeout(1500);
    ok(await pa.getByText("Carlos Díaz").first().isVisible(), "A: Ana reasignada a Carlos (visible en la ficha)");
    await pa.screenshot({ path: `${SHOTS}/d22-ficha-responsable.png` });
    await cA.close();

    // B) vendedor2: ya NO ve a Ana (reasignada a Carlos)
    const { ctx: cV, page: pv } = await login(V2);
    await pv.goto(`${BASE}/clientes`);
    await pv.waitForTimeout(2000);
    ok(!(await pv.getByRole("button", { name: "Mis clientes" }).isVisible().catch(() => false)),
      "B: el operativo NO ve el toggle de cartera (solo admin)");
    ok(!(await pv.getByText("Ana García").first().isVisible().catch(() => false)),
      "B: vendedor2 ya no ve a Ana en su lista (reasignada)");
    // Intentar abrir la ficha de Ana por URL → 'no encontrado' (fuera de su cartera)
    await pv.goto(`${BASE}/clientes/${ANA}`);
    await pv.waitForTimeout(2000);
    ok(await pv.getByText(/no encontrado/i).isVisible().catch(() => false),
      "B: la ficha de Ana (ajena) muestra 'no encontrado' para vendedor2");
    await cV.close();

    // C) Carlos: ahora SÍ ve a Ana; su ficha sin selector de responsable
    const { ctx: cC, page: pc } = await login(CARLOS);
    await pc.goto(`${BASE}/clientes`);
    await pc.waitForTimeout(2000);
    ok(await pc.getByText("Ana García").first().isVisible(), "C: Carlos ve a Ana en su cartera (reasignada)");
    await pc.goto(`${BASE}/clientes/${ANA}`);
    await pc.waitForTimeout(2000);
    ok(await pc.getByText("Ana García").first().isVisible(), "C: Carlos abre la ficha de Ana (es suya)");
    ok(!(await pc.getByLabel("Cambiar responsable del cliente").isVisible().catch(() => false)),
      "C: el operativo NO ve el selector de responsable (solo lo cambia el admin)");
    ok(await pc.getByText("Carlos Díaz").first().isVisible(), "C: la ficha muestra a Carlos como responsable (lectura)");
    await cC.close();
  } catch (e) {
    ok(false, `excepción: ${String(e).slice(0, 200)}`);
  } finally {
    await browser.close().catch(() => {});
  }

  if (errNav.length) { console.error("Errores de navegador:", errNav); fallos.push("errores de navegador"); }
  else { resultados.push("PASS — sin pageerror ni console.error inesperados"); console.log("PASS — sin errores de navegador"); }
  fs.writeFileSync(REPORTE, [
    "Reporte driver-22 cartera (JUA-43)", `fecha: ${new Date().toISOString()}`, `baseUrl: ${BASE}`,
    `resultado: ${fallos.length === 0 ? "OK" : "CON FALLOS"} (${resultados.filter((r) => r.startsWith("PASS")).length} PASS / ${fallos.length} FAIL)`,
    "", ...resultados, "", `errores navegador: ${errNav.length}`, ...errNav.map((e) => "  " + e),
  ].join("\n") + "\n");
  console.log(`\nReporte en ${REPORTE}`);
  process.exit(fallos.length ? 1 : 0);
})();
