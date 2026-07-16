// Driver 16 — JUA-44 Exportación de datos (E2E). Credenciales por env
// (ADMIN_PASS / OPER_PASS). Reporte durable con tokens redactados; vigila
// pageerror/console.error; limpieza no requerida (el consumo agota el enlace).
//  A) operativo: no ve "Exportar datos" en Perfil y /exportar-datos lo expulsa
//  B) admin: Perfil → Exportar datos → generar → enlace; abrir descarga →
//     descargar los 4 CSV (interceptados) → contenido legible con cabeceras →
//     el enlace queda de un solo uso (recargar = "Enlace ya utilizado")
// Uso: ADMIN_PASS=.. OPER_PASS=.. node driver-16-exportar.js [rutaReporte]
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "marta@demo.mx";
const OPER_EMAIL = process.env.OPER_EMAIL || "carlos@demo.mx";
const ADMIN_PASS = process.env.ADMIN_PASS;
const OPER_PASS = process.env.OPER_PASS;
const REPORTE = process.argv[2] || `${SHOTS}/reporte-exportar.txt`;
const ESPERADAS = ["clientes.csv", "notas.csv", "oportunidades.csv", "recordatorios.csv"];

(async () => {
  if (!ADMIN_PASS || !OPER_PASS) throw new Error("Faltan ADMIN_PASS / OPER_PASS en el entorno");
  const browser = await chromium.launch();
  const resultados = [];
  const fallos = [];
  const erroresNavegador = [];
  const ok = (cond, msg) => {
    const l = `${cond ? "PASS" : "FAIL"} — ${msg}`;
    console.log(l);
    resultados.push(l);
    if (!cond) fallos.push(msg);
  };
  const visible = (loc, t = 15000) => loc.waitFor({ state: "visible", timeout: t }).then(() => true).catch(() => false);
  const vigilar = (page, rol) => {
    page.on("pageerror", (e) => erroresNavegador.push(`[${rol}] pageerror: ${String(e).slice(0, 200)}`));
    page.on("console", (m) => { if (m.type() === "error") erroresNavegador.push(`[${rol}] console.error: ${m.text().slice(0, 200)}`); });
  };
  const login = async (email, pass, rol) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
    const page = await ctx.newPage();
    vigilar(page, rol);
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder("nombre@empresa.mx").fill(email);
    await page.getByPlaceholder("••••••••").fill(pass);
    await page.getByRole("button", { name: /Entrar/i }).click();
    await page.waitForURL("**/inicio", { timeout: 20000 });
    return { ctx, page };
  };

  // A) Operativo
  const { ctx: ctxO, page: po } = await login(OPER_EMAIL, OPER_PASS, "operativo");
  await po.goto(`${BASE}/perfil`);
  await po.waitForTimeout(1500);
  ok(
    !(await po.getByRole("link", { name: /Exportar datos/ }).isVisible().catch(() => false)),
    "A: el operativo NO ve 'Exportar datos' en Perfil",
  );
  await po.goto(`${BASE}/exportar-datos`);
  await po.waitForURL("**/inicio", { timeout: 15000 });
  ok(true, "A: /exportar-datos expulsa al operativo a /inicio");
  await ctxO.close();

  // B) Admin
  const { ctx: ctxA, page: pa } = await login(ADMIN_EMAIL, ADMIN_PASS, "admin");
  await pa.goto(`${BASE}/perfil`);
  await pa.waitForTimeout(1500);
  const acceso = pa.getByRole("link", { name: /Exportar datos/ });
  ok(await visible(acceso), "B: el admin ve 'Exportar datos' en Perfil");
  await acceso.click();
  await pa.waitForURL("**/exportar-datos", { timeout: 15000 });
  await pa.getByRole("button", { name: "Generar exportación" }).click();
  ok(await visible(pa.getByText("Enlace de descarga listo")), "B: genera el enlace de descarga");
  await pa.getByRole("button", { name: "Copiar enlace" }).click();
  const enlace = await pa.evaluate(() => navigator.clipboard.readText());
  ok(/\/exportar\?token=[0-9a-f]{64}$/.test(enlace), "B: enlace con token único de 64 hex");
  await pa.screenshot({ path: `${SHOTS}/d16-enlace-listo.png` });

  // Abrir la página de descarga e interceptar las 4 descargas
  const pd = await ctxA.newPage();
  vigilar(pd, "descarga");
  // OBS-3: los CSV son datos completos del negocio — se guardan en un dir
  // TEMPORAL fuera del árbol de evidencia y se borran al terminar.
  const os = require("os");
  const path = require("path");
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "exp-qa-"));
  // OBS-2: el borrado se garantiza en la salida del proceso (cubre cualquier
  // excepción de Playwright entre la descarga y el final), no solo en la ruta feliz.
  process.on("exit", () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {} });
  const descargas = new Map();
  pd.on("download", async (d) => {
    const nombre = d.suggestedFilename();
    const dest = path.join(TMP, nombre);
    await d.saveAs(dest);
    descargas.set(nombre, fs.readFileSync(dest, "utf8"));
  });
  await pd.goto(enlace);
  ok(await visible(pd.getByText("Descargar datos")), "B: la página de descarga carga (enlace válido)");
  await pd.getByRole("button", { name: "Descargar los 4 archivos" }).click();
  await pd.waitForTimeout(3000);
  ok(ESPERADAS.every((n) => descargas.has(n)), `B: se descargan los 4 CSV (${[...descargas.keys()].length}/4)`);
  const clientes = descargas.get("clientes.csv") || "";
  ok(clientes.charCodeAt(0) === 0xfeff, "B: clientes.csv lleva BOM (Excel-friendly)");
  ok(/^﻿?Nombre,Tipo,Tel/.test(clientes), "B: clientes.csv tiene cabeceras legibles");
  ok(/Ana García/.test(clientes), "B: clientes.csv contiene datos reales del negocio");
  await pd.screenshot({ path: `${SHOTS}/d16-descargas.png` });

  // Un solo uso: recargar la página de descarga
  await pd.goto(enlace);
  ok(await visible(pd.getByText("Enlace ya utilizado")), "B: el enlace es de un solo uso");
  await ctxA.close();

  await browser.close();
  // OBS-3: no dejar copias de los datos del negocio en disco.
  fs.rmSync(TMP, { recursive: true, force: true });
  if (erroresNavegador.length) {
    console.error(`Errores de navegador NO esperados (${erroresNavegador.length}):`);
    for (const e of erroresNavegador) console.error("  " + e);
    fallos.push("errores de navegador inesperados");
  } else {
    resultados.push("PASS — sin pageerror ni console.error inesperados");
    console.log("PASS — sin pageerror ni console.error inesperados");
  }
  fs.writeFileSync(REPORTE, [
    "Reporte driver-16 exportar (JUA-44)",
    `fecha: ${new Date().toISOString()}`, `baseUrl: ${BASE}`,
    `resultado: ${fallos.length === 0 ? "OK" : "CON FALLOS"} (${resultados.filter((r) => r.startsWith("PASS")).length} PASS / ${fallos.length} FAIL)`,
    "tokens no persistidos; CSV descargados solo para verificación.", "",
    ...resultados, "", `errores de navegador no esperados: ${erroresNavegador.length}`, ...erroresNavegador.map((e) => "  " + e),
  ].join("\n") + "\n");
  console.log(`\nReporte en ${REPORTE}`);
  process.exit(fallos.length ? 1 : 0);
})();
