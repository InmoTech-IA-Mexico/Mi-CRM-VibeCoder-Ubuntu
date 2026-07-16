// Driver 1 — Invitaciones (como Marta, admin):
//  a) invita a Verónica (operativo) y Alberto (admin)
//  b) intenta invitar a carlos@demo.mx → debe fallar con "Ya existe una cuenta con ese email"
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fallos = [];
  const ok = (cond, msg) => {
    console.log(`${cond ? "PASS" : "FAIL"} — ${msg}`);
    if (!cond) fallos.push(msg);
  };

  // Login como Marta (admin)
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder("nombre@empresa.mx").fill("marta@demo.mx");
  await page.getByPlaceholder("••••••••").fill("Marta1234");
  await page.getByRole("button", { name: /Entrar/i }).click();
  await page.waitForURL("**/inicio", { timeout: 20000 });
  ok(true, "login admin OK");

  await page.goto(`${BASE}/usuarios`);
  await page.waitForTimeout(1500);

  const invitar = async (email, nombre, rolLabel) => {
    await page.getByLabel("Invitar usuario").click();
    await page.getByLabel("Email del invitado").fill(email);
    await page.getByLabel("Nombre del invitado").fill(nombre);
    if (rolLabel) await page.getByRole("button", { name: rolLabel, exact: true }).click();
    await page.getByRole("button", { name: "Enviar invitación" }).click();
    await page.waitForTimeout(1200);
  };
  const cerrarHoja = async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
  };

  // a) Operativo + admin (idempotente: solo si no existen de una corrida previa)
  if (!(await page.getByText("veronica.prueba@test.mx").isVisible())) {
    await invitar("veronica.prueba@test.mx", "Verónica Prueba");
  }
  ok(await page.getByText("veronica.prueba@test.mx").isVisible(), "invitación operativo creada y listada");

  if (!(await page.getByText("alberto.prueba@test.mx").isVisible())) {
    await invitar("alberto.prueba@test.mx", "Alberto Prueba", "Administrador");
  }
  ok(await page.getByText("alberto.prueba@test.mx").isVisible(), "invitación admin creada y listada");

  // b) Email ya existente (Carlos, usuario activo) → error de unicidad GLOBAL
  await invitar("carlos@demo.mx", "Carlos Duplicado");
  ok(
    await page.getByText("Ya existe una cuenta con ese email", { exact: true }).isVisible(),
    'invitar email existente muestra "Ya existe una cuenta con ese email"',
  );
  await page.screenshot({ path: `${SHOTS}/d1-invitar-duplicado.png` });
  await cerrarHoja();

  // c) Invitación pendiente duplicada → mensaje específico
  await invitar("veronica.prueba@test.mx", "Verónica Bis");
  ok(
    await page.getByText("Ya hay una invitación pendiente para ese email", { exact: true }).isVisible(),
    'reinvitar email con invitación vigente muestra "Ya hay una invitación pendiente"',
  );

  await browser.close();
  if (fallos.length) {
    console.error(`\n${fallos.length} fallo(s)`);
    process.exit(1);
  }
  console.log("\nDriver 1 OK");
})();
