// Driver 9 — JUA-37: marcar Ganada desde la ficha crea el recordatorio post-venta.
// Uso: node driver-9-postventa.js <clienteId> <nombreOportunidad>
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const [CLIENTE_ID, OPO_NOMBRE] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fallos = [];
  const ok = (cond, msg) => {
    console.log(`${cond ? "PASS" : "FAIL"} — ${msg}`);
    if (!cond) fallos.push(msg);
  };

  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder("nombre@empresa.mx").fill("marta@demo.mx");
  await page.getByPlaceholder("••••••••").fill("Marta1234");
  await page.getByRole("button", { name: /Entrar/i }).click();
  await page.waitForURL("**/inicio", { timeout: 20000 });

  await page.goto(`${BASE}/clientes/${CLIENTE_ID}`);
  await page.waitForTimeout(2500);

  // Abrir la oportunidad y marcarla Ganada (flujo JUA-21/122)
  await page.getByText(OPO_NOMBRE).first().click();
  await page.waitForTimeout(800);
  ok(await page.getByText("Cambiar etapa del pipeline").isVisible(), "hoja de oportunidad abierta");
  await page.getByRole("button", { name: "Ganada", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Guardar cambio" }).click();
  await page.waitForTimeout(2000);

  // Cerrar la hoja si sigue abierta (celebración JUA-122)
  const cerrar = page.getByRole("button", { name: "Cerrar" }).last();
  if (await cerrar.isVisible().catch(() => false)) {
    await cerrar.click();
    await page.waitForTimeout(800);
  }

  // El recordatorio post-venta debe aparecer en la ficha del cliente
  await page.waitForTimeout(1500);
  const visible = await page.getByText(/Seguimiento post-venta/).first().isVisible();
  ok(visible, "la ficha muestra el recordatorio 'Seguimiento post-venta: …'");
  await page.screenshot({ path: `${SHOTS}/d9-postventa-ficha.png`, fullPage: true });

  await browser.close();
  if (fallos.length) {
    console.error(`\n${fallos.length} fallo(s)`);
    process.exit(1);
  }
  console.log("\nDriver 9 OK");
})();
