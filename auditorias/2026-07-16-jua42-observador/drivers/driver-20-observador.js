// Driver 20 — JUA-42 rol Observador (UI). Credenciales por env. Reporte durable;
// vigila pageerror/console.error.
//  A) admin: la hoja de invitar ofrece los 3 roles (incl. Observador).
//  B) observador: navega consulta (inicio, lista, ficha, ESTADO) SIN botones.
//  C) observador: las 7 rutas de alta/edición por URL → redirigen a /inicio.
// Uso: ADMIN_PASS=.. OBS_PASS=.. node driver-20-observador.js <clienteId> [reporte]
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "marta@demo.mx";
const OBS_EMAIL = process.env.OBS_EMAIL || "observador.qa@test.mx";
const ADMIN_PASS = process.env.ADMIN_PASS;
const OBS_PASS = process.env.OBS_PASS;
const CLIENTE = process.argv[2];
const REPORTE = process.argv[3] || `${SHOTS}/reporte-observador-ui.txt`;

(async () => {
  if (!ADMIN_PASS || !OBS_PASS) throw new Error("Faltan ADMIN_PASS / OBS_PASS");
  const browser = await chromium.launch();
  const resultados = [];
  const fallos = [];
  const erroresNavegador = [];
  const ok = (c, m) => { const l = `${c ? "PASS" : "FAIL"} — ${m}`; console.log(l); resultados.push(l); if (!c) fallos.push(m); };
  // Ruido esperado del navegador: al redirigir el guard de una pantalla de alta
  // sin gesto del usuario, Chrome bloquea el panel `beforeunload` del formulario
  // y lo loguea (chromestatus). No es un error de la app.
  const ESPERADO = /beforeunload|chromestatus\.com/;
  const vigilar = (page, rol) => {
    page.on("pageerror", (e) => { if (!ESPERADO.test(String(e))) erroresNavegador.push(`[${rol}] pageerror: ${String(e).slice(0, 200)}`); });
    page.on("console", (msg) => { if (msg.type() === "error" && !ESPERADO.test(msg.text())) erroresNavegador.push(`[${rol}] console.error: ${msg.text().slice(0, 200)}`); });
  };
  const vis = (loc, t = 12000) => loc.waitFor({ state: "visible", timeout: t }).then(() => true).catch(() => false);
  const login = async (email, pass, rol) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    vigilar(page, rol);
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder("nombre@empresa.mx").fill(email);
    await page.getByPlaceholder("••••••••").fill(pass);
    await page.getByRole("button", { name: /Entrar/i }).click();
    await page.waitForURL("**/inicio", { timeout: 20000 });
    return { ctx, page };
  };

  try {
  // A) Admin: hoja de invitar con 3 roles
  const { ctx: ctxA, page: pa } = await login(ADMIN_EMAIL, ADMIN_PASS, "admin");
  await pa.goto(`${BASE}/usuarios`);
  await pa.waitForTimeout(1500);
  await pa.getByLabel("Invitar usuario").click();
  await pa.waitForTimeout(500);
  for (const r of ["Administrador", "Operativo", "Observador"]) {
    ok(await vis(pa.getByRole("button", { name: new RegExp(r) })), `A: la hoja de invitar ofrece el rol ${r}`);
  }
  await pa.screenshot({ path: `${SHOTS}/d20-invitar-roles.png` });
  await ctxA.close();

  // B) Observador: navegación de consulta sin acciones
  const { ctx: ctxO, page: po } = await login(OBS_EMAIL, OBS_PASS, "observador");
  // /inicio: sin FAB
  ok(!(await po.getByLabel(/Nuevo|Programar|Nueva/).first().isVisible().catch(() => false)),
    "B: Inicio no muestra el FAB de acción");

  // Lista de clientes: carga, sin FAB
  await po.goto(`${BASE}/clientes`);
  await po.waitForTimeout(2000);
  ok((await po.locator("a[href^='/clientes/j']").count()) > 0, "B: la lista de clientes carga (lectura)");
  const fab = po.locator("a[href='/clientes/nuevo'], a[href='/ventas/nueva'], a[href='/seguimientos/nuevo']");
  ok((await fab.count()) === 0, "B: la lista no muestra FAB ni enlaces de creación");

  // Ficha de cliente: sin editar, sin acciones, sin registrar venta
  await po.goto(`${BASE}/clientes/${CLIENTE}`);
  await po.waitForTimeout(2000);
  ok(await po.getByText("Ana García").first().isVisible(), "B: la ficha del cliente carga (lectura)");
  ok(!(await po.getByLabel("Editar cliente").isVisible().catch(() => false)), "B: la ficha NO muestra 'Editar cliente'");
  ok(!(await po.getByLabel("Más acciones").isVisible().catch(() => false)), "B: la ficha NO muestra 'Más acciones' (estado/papelera)");
  ok(!(await po.getByRole("button", { name: "Registrar venta" }).isVisible().catch(() => false)), "B: la ficha NO muestra 'Registrar venta'");
  ok(!(await po.getByRole("link", { name: "Programar seguimiento" }).isVisible().catch(() => false)), "B: la ficha NO muestra 'Programar seguimiento'");
  ok(!(await po.getByLabel("Nueva oportunidad").isVisible().catch(() => false)), "B: la ficha NO muestra el '+' de nueva oportunidad");
  ok(!(await po.getByLabel("Cambiar prioridad del cliente").isVisible().catch(() => false)), "B: la ficha NO muestra el selector de prioridad");
  ok(!(await po.getByLabel("Editar etiquetas de producto").isVisible().catch(() => false)), "B: la ficha NO muestra el botón de editar etiquetas");
  await po.screenshot({ path: `${SHOTS}/d20-ficha-observador.png`, fullPage: true });

  // B2) Estado global de clientes: SÍ accesible al observador (núcleo de lectura)
  await po.goto(`${BASE}/estado`);
  await po.waitForTimeout(2000);
  ok(po.url().endsWith("/estado") && !(await po.getByText(/No autorizado/).isVisible().catch(() => false)),
    "B: /estado (estado global) es accesible al observador en lectura");

  // C) Guards de ruta por URL directa — las 7 páginas de alta/edición
  const rutas = [
    "/clientes/nuevo",
    `/clientes/${CLIENTE}/editar`,
    `/clientes/${CLIENTE}/nota`,
    `/clientes/${CLIENTE}/oportunidad`,
    `/clientes/${CLIENTE}/recordatorio`,
    "/seguimientos/nuevo",
    "/ventas/nueva",
  ];
  for (const r of rutas) {
    await po.goto(`${BASE}${r}`);
    const red = await po.waitForURL("**/inicio", { timeout: 15000 }).then(() => true).catch(() => false);
    ok(red, `C: ${r} redirige al observador a /inicio`);
  }
  await ctxO.close();
  } catch (e) {
    ok(false, `excepción no controlada: ${String(e).slice(0, 200)}`);
  } finally {
    await browser.close().catch(() => {}); // OBS-5: cerrar el navegador pase lo que pase
  }
  if (erroresNavegador.length) {
    console.error(`Errores de navegador NO esperados (${erroresNavegador.length}):`);
    for (const e of erroresNavegador) console.error("  " + e);
    fallos.push("errores de navegador inesperados");
  } else {
    resultados.push("PASS — sin pageerror ni console.error inesperados");
    console.log("PASS — sin pageerror ni console.error inesperados");
  }
  fs.writeFileSync(REPORTE, [
    "Reporte driver-20 Observador UI (JUA-42)",
    `fecha: ${new Date().toISOString()}`, `baseUrl: ${BASE}`,
    `resultado: ${fallos.length === 0 ? "OK" : "CON FALLOS"} (${resultados.filter((r) => r.startsWith("PASS")).length} PASS / ${fallos.length} FAIL)`,
    "", ...resultados, "", `errores de navegador no esperados: ${erroresNavegador.length}`, ...erroresNavegador.map((e) => "  " + e),
  ].join("\n") + "\n");
  console.log(`\nReporte en ${REPORTE}`);
  process.exit(fallos.length ? 1 : 0);
})();
