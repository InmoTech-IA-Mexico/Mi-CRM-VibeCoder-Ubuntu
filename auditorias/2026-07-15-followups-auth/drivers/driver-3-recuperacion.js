// Driver 3 — Recuperación endurecida (usuario debe estar ACTIVO):
//  a) enlace válido con Verónica activa
//  b) Marta revoca a Verónica → el mismo enlace pasa a "no válido"
//  c) Marta reactiva a Verónica → el enlace vuelve a valer → restablecer → login con la nueva clave
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const TOKEN_REC = process.argv[2];

(async () => {
  const browser = await chromium.launch();
  const fallos = [];
  const ok = (cond, msg) => {
    console.log(`${cond ? "PASS" : "FAIL"} — ${msg}`);
    if (!cond) fallos.push(msg);
  };

  const nuevoCtx = () => browser.newContext({ viewport: { width: 390, height: 844 } });

  // Contexto de Marta (admin) para revocar/reactivar
  const ctxAdmin = await nuevoCtx();
  const admin = await ctxAdmin.newPage();
  await admin.goto(`${BASE}/login`);
  await admin.getByPlaceholder("nombre@empresa.mx").fill("marta@demo.mx");
  await admin.getByPlaceholder("••••••••").fill("Marta1234");
  await admin.getByRole("button", { name: /Entrar/i }).click();
  await admin.waitForURL("**/inicio", { timeout: 20000 });
  await admin.goto(`${BASE}/usuarios`);
  await admin.waitForTimeout(1500);
  const tarjetaVero = admin.locator("div.rounded-2xl").filter({ hasText: "veronica.prueba@test.mx" });

  // a) Enlace válido con la usuaria activa
  const ctx1 = await nuevoCtx();
  const p1 = await ctx1.newPage();
  await p1.goto(`${BASE}/nueva-password?token=${TOKEN_REC}`);
  await p1.waitForTimeout(2000);
  ok(await p1.getByLabel("Nueva contraseña").isVisible(), "enlace válido: muestra el formulario (usuaria activa)");
  await ctx1.close();

  // b) Revocar a Verónica → porToken debe pasar a inválida
  await tarjetaVero.getByRole("button", { name: "Revocar" }).click();
  await admin.waitForTimeout(1500);
  ok(await tarjetaVero.getByText("Reactivar").isVisible(), "admin: Verónica revocada (botón Reactivar visible)");

  const ctx2 = await nuevoCtx();
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/nueva-password?token=${TOKEN_REC}`);
  await p2.waitForTimeout(2000);
  ok(
    await p2.getByText("Enlace no válido").isVisible(),
    "usuaria revocada: el mismo enlace se muestra como no válido",
  );
  await p2.screenshot({ path: `${SHOTS}/d3-enlace-invalido-revocada.png` });
  await ctx2.close();

  // c) Reactivar → el enlace vuelve a valer → restablecer → login con la nueva clave
  await tarjetaVero.getByRole("button", { name: "Reactivar" }).click();
  await admin.waitForTimeout(1500);
  ok(await tarjetaVero.getByText("Revocar").isVisible(), "admin: Verónica reactivada");
  await ctxAdmin.close();

  const ctx3 = await nuevoCtx();
  const p3 = await ctx3.newPage();
  await p3.goto(`${BASE}/nueva-password?token=${TOKEN_REC}`);
  await p3.waitForTimeout(2000);
  ok(await p3.getByLabel("Nueva contraseña").isVisible(), "reactivada: el enlace vuelve a ser válido");
  await p3.getByLabel("Nueva contraseña").fill("NuevaClave123");
  await p3.getByLabel("Confirmar contraseña").fill("NuevaClave123");
  await p3.getByRole("button", { name: "Guardar contraseña" }).click();
  await p3.waitForURL("**/login?reset=1", { timeout: 20000 });
  ok(true, "restablecer OK → redirige a /login?reset=1");

  await p3.getByPlaceholder("nombre@empresa.mx").fill("veronica.prueba@test.mx");
  await p3.getByPlaceholder("••••••••").fill("NuevaClave123");
  await p3.getByRole("button", { name: /Entrar/i }).click();
  await p3.waitForURL("**/inicio", { timeout: 20000 });
  ok(true, "login con la contraseña nueva OK → /inicio");
  await ctx3.close();

  await browser.close();
  if (fallos.length) {
    console.error(`\n${fallos.length} fallo(s)`);
    process.exit(1);
  }
  console.log("\nDriver 3 OK");
})();
