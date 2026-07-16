// Driver 7 — smoke prod: invitar un email ya registrado debe mostrar el motivo
// real ("Ya existe una cuenta con ese email") gracias a ConvexError (JUA-120).
// No crea datos: la invitación se rechaza en servidor.
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";

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
  await page.getByLabel("Email del invitado").fill("carlos@demo.mx");
  await page.getByLabel("Nombre del invitado").fill("Duplicado QA");
  await page.getByRole("button", { name: "Enviar invitación" }).click();
  await page.waitForTimeout(2000);
  const visible = await page
    .getByText("Ya existe una cuenta con ese email", { exact: true })
    .isVisible();
  await page.screenshot({ path: `${SHOTS}/smoke-prod-duplicado.png` });
  console.log(
    visible
      ? 'PASS — prod muestra "Ya existe una cuenta con ese email" (ConvexError llega al cliente)'
      : "FAIL — no se mostró el motivo real en prod",
  );
  await browser.close();
  process.exit(visible ? 0 : 1);
})();
