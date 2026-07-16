// Driver 10 — smoke prod JUA-37: la ficha muestra el post-venta y su gestión se abre.
// Uso: BASE_URL=<prod> node driver-10-postventa-prod.js <clienteId>
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const CLIENTE_ID = process.argv[2];

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
  await page.waitForTimeout(3000);

  const fila = page.locator("div.rounded-2xl").filter({ hasText: "Seguimiento post-venta" }).first();
  ok(await fila.isVisible(), "la ficha muestra el recordatorio post-venta (prod)");
  ok(await fila.getByText("30 jul").isVisible(), "con fecha 30 jul (+15 días en tz del negocio)");

  await fila.getByLabel("Acciones del recordatorio").click();
  await page.waitForTimeout(800);
  ok(
    await page.getByText("Marcar realizado").isVisible(),
    "el menú de gestión (JUA-24) se abre desde la ficha",
  );
  await page.screenshot({ path: `${SHOTS}/d10-postventa-prod-gestion.png` });

  await browser.close();
  if (fallos.length) {
    console.error(`\n${fallos.length} fallo(s)`);
    process.exit(1);
  }
  console.log("\nDriver 10 OK");
})();
