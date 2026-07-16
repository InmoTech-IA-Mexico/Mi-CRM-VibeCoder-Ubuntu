// Mini-driver — como Marta, pulsa "Revocar" o "Reactivar" en la tarjeta de Verónica.
// Uso: node driver-4-toggle-veronica.js <Revocar|Reactivar>
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const ACCION = process.argv[2];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder("nombre@empresa.mx").fill("marta@demo.mx");
  await page.getByPlaceholder("••••••••").fill("Marta1234");
  await page.getByRole("button", { name: /Entrar/i }).click();
  await page.waitForURL("**/inicio", { timeout: 20000 });
  await page.goto(`${BASE}/usuarios`);
  await page.waitForTimeout(1500);
  const tarjeta = page.locator("div.rounded-2xl").filter({ hasText: "veronica.prueba@test.mx" });
  await tarjeta.getByRole("button", { name: ACCION }).click();
  await page.waitForTimeout(1500);
  const esperado = ACCION === "Revocar" ? "Reactivar" : "Revocar";
  const okFinal = await tarjeta.getByRole("button", { name: esperado }).isVisible();
  console.log(okFinal ? `OK — ${ACCION} aplicado` : `FALLO — ${ACCION}`);
  await browser.close();
  process.exit(okFinal ? 0 : 1);
})();
