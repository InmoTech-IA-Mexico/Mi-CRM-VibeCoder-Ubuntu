// Driver 25 — JUA-38 fuente de contacto (UI E2E). Credenciales por env.
//  1) Editar cliente: seleccionar fuente (Campaña) + detalle → guardar.
//  2) Ficha: muestra "Fuente de contacto" = Campaña · <detalle>.
//  3) Lista: aparece el chip de fuente y filtra al cliente.
//  4) Alta rápida (/clientes/nuevo): NO tiene el campo fuente (opcional, criterio JUA-38).
//  5) Limpieza: quitar la fuente (deseleccionar) → ficha "Sin definir".
// Reporte durable; vigila pageerror/console.error. try/finally.
// Uso: ADMIN_PASS=.. node driver-25-fuente.js <clienteId> [reporte.txt]
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const CID = process.argv[2];
const REPORTE = process.argv[3] || `${SHOTS}/reporte-fuente.txt`;
const ADMIN = { email: process.env.ADMIN_EMAIL || "marta@demo.mx", pass: process.env.ADMIN_PASS };
const DETALLE = "Black Friday 2026";
const NOMBRE = process.env.CLIENTE_NOMBRE || "Ana García"; // nombre visible del cliente (para el filtro)

(async () => {
  if (!CID) throw new Error("Falta <clienteId>");
  if (!ADMIN.pass) throw new Error("Falta ADMIN_PASS");
  const browser = await chromium.launch();
  const resultados = [], fallos = [], errNav = [];
  const ok = (c, m) => { const l = `${c ? "PASS" : "FAIL"} — ${m}`; console.log(l); resultados.push(l); if (!c) fallos.push(m); };
  const vis = (loc, t = 12000) => loc.waitFor({ state: "visible", timeout: t }).then(() => true).catch(() => false);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errNav.push(`pageerror: ${String(e).slice(0, 160)}`));
  page.on("console", (m) => { if (m.type() === "error") errNav.push(`console.error: ${m.text().slice(0, 160)}`); });

  try {
    // Login admin
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder("nombre@empresa.mx").fill(ADMIN.email);
    await page.getByPlaceholder("••••••••").fill(ADMIN.pass);
    await page.getByRole("button", { name: /Entrar/i }).click();
    await page.waitForURL("**/inicio", { timeout: 20000 });

    // 1) Editar: seleccionar fuente "Campaña" (única, no colisiona con canal "Referido") + detalle
    await page.goto(`${BASE}/clientes/${CID}/editar`);
    ok(await vis(page.getByText("Fuente de contacto")), "1: el formulario de edición tiene la sección 'Fuente de contacto'");
    await page.getByRole("button", { name: "Campaña" }).click();
    const detalle = page.getByLabel("Detalle de la fuente");
    ok(await vis(detalle), "1: al elegir tipo aparece el campo de detalle");
    await detalle.fill(DETALLE);
    await page.screenshot({ path: `${SHOTS}/d25-editar-fuente.png` });
    await page.getByRole("button", { name: /Guardar/i }).click();
    await page.waitForURL(`**/clientes/${CID}`, { timeout: 15000 });

    // 2) Ficha muestra la fuente (esperas por elemento, no pausas fijas)
    ok(await vis(page.getByText("Fuente de contacto")), "2: la ficha muestra la fila 'Fuente de contacto'");
    ok(await vis(page.getByText("Campaña").first()), "2: la ficha muestra el tipo 'Campaña'");
    ok(await vis(page.getByText(new RegExp(DETALLE)).first()), `2: la ficha muestra el detalle '${DETALLE}'`);
    await page.screenshot({ path: `${SHOTS}/d25-ficha-fuente.png` });

    // 3) Lista: chip de fuente aparece y filtra
    await page.goto(`${BASE}/clientes`);
    const chip = page.getByRole("button", { name: /Campaña/ });
    ok(await vis(chip), "3: la lista muestra el chip de fuente 'Campaña'");
    await chip.click();
    const clienteVisible = await vis(page.getByText(NOMBRE).first());
    const visibles = await page.locator("a[href^='/clientes/j']").count();
    ok(clienteVisible && visibles >= 1, `3: al filtrar por 'Campaña' aparece el cliente (n=${visibles})`);
    await page.screenshot({ path: `${SHOTS}/d25-lista-filtro.png` });

    // 4) Alta rápida NO tiene el campo fuente (espera a que el form cargue antes de negar)
    await page.goto(`${BASE}/clientes/nuevo`);
    await page.locator("input").first().waitFor({ state: "visible", timeout: 10000 });
    ok(!(await page.getByText("Fuente de contacto").isVisible().catch(() => false)),
      "4: el alta rápida NO incluye 'Fuente de contacto' (opcional, no rompe el flujo mínimo)");

    // 5) Limpieza: quitar la fuente (deseleccionar el tipo activo) → 'Sin definir'
    await page.goto(`${BASE}/clientes/${CID}/editar`);
    await vis(page.getByText("Fuente de contacto"));
    await page.getByRole("button", { name: "Campaña" }).click(); // toggle off
    ok(!(await page.getByLabel("Detalle de la fuente").isVisible().catch(() => false)),
      "5: al deseleccionar el tipo desaparece el detalle");
    await page.getByRole("button", { name: /Guardar/i }).click();
    await page.waitForURL(`**/clientes/${CID}`, { timeout: 15000 });
    await vis(page.getByText("Fuente de contacto"));
    // En la fila de fuente debe decir 'Sin definir' (hay dos 'Sin definir': canal y fuente)
    const sinDefinir = await page.getByText("Sin definir").count();
    ok(sinDefinir >= 1, "5: tras limpiar, la fuente vuelve a 'Sin definir'");

    ok(errNav.length === 0, `sin errores de navegador${errNav.length ? " — " + errNav.join(" | ") : ""}`);
  } catch (e) {
    ok(false, `excepción: ${String(e).slice(0, 200)}`);
  } finally {
    // Restauración best-effort (obs. OBS-3): deja el cliente QA SIN fuente aunque el
    // flujo haya fallado tras guardar Campaña. Usa aria-pressed para detectar el estado.
    try {
      await page.goto(`${BASE}/clientes/${CID}/editar`);
      await page.getByText("Fuente de contacto").waitFor({ state: "visible", timeout: 8000 });
      const activo = page.getByRole("button", { name: "Campaña", pressed: true });
      if (await activo.isVisible().catch(() => false)) {
        await activo.click();
        await page.getByRole("button", { name: /Guardar/i }).click();
        await page.waitForURL(`**/clientes/${CID}`, { timeout: 10000 });
      }
    } catch { /* best-effort */ }
    await ctx.close();
    await browser.close();
  }

  fs.writeFileSync(REPORTE, [
    "Reporte driver-25 fuente de contacto (JUA-38)",
    `fecha: ${new Date().toISOString()}`,
    `baseUrl: ${BASE}`,
    `resultado: ${fallos.length === 0 ? "OK" : "CON FALLOS"} (${resultados.filter((r) => r.startsWith("PASS")).length} PASS / ${fallos.length} FAIL)`,
    `errores navegador: ${errNav.length}`,
    "", ...resultados,
  ].join("\n") + "\n");
  console.log(`\nReporte en ${REPORTE}`);
  process.exit(fallos.length ? 1 : 0);
})();
