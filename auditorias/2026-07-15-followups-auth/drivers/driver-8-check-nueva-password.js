// Driver 8 — comprueba el estado de un enlace de recuperación en /nueva-password.
// Uso: node driver-8-check-nueva-password.js <token> <valida|invalida> [captura.png]
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const [TOKEN, ESPERADO, SHOT] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${BASE}/nueva-password?token=${TOKEN}`);
  await page.waitForTimeout(2500);
  const esValida = await page.getByLabel("Nueva contraseña").isVisible();
  const esInvalida = await page.getByText("Enlace no válido").isVisible();
  const ok = ESPERADO === "valida" ? esValida && !esInvalida : esInvalida && !esValida;
  if (SHOT) await page.screenshot({ path: SHOT });
  console.log(`${ok ? "PASS" : "FAIL"} — enlace se muestra como ${ESPERADO}`);
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
