// Driver 5 — crea una invitación (email/nombre/rol por argumentos), como Marta.
// Uso: node driver-5-invitar-nuevos.js <email> <nombre> [Administrador]
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const [EMAIL, NOMBRE, ROL] = process.argv.slice(2);

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
  await page.getByLabel("Invitar usuario").click();
  await page.getByLabel("Email del invitado").fill(EMAIL);
  await page.getByLabel("Nombre del invitado").fill(NOMBRE);
  if (ROL) await page.getByRole("button", { name: ROL, exact: true }).click();
  await page.getByRole("button", { name: "Enviar invitación" }).click();
  await page.waitForTimeout(1500);
  const creada = await page.getByText(EMAIL).isVisible();
  console.log(creada ? `OK — invitación ${EMAIL} creada` : `FALLO — ${EMAIL}`);
  await browser.close();
  process.exit(creada ? 0 : 1);
})();
