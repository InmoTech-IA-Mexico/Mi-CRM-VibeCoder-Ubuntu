// Driver 6 — re-verificación de la bienvenida tras aplicar las observaciones:
//  · la bienvenida SOBREVIVE a una recarga (OBS-1, sessionStorage)
//  · Empezar limpia la persistencia: revisitar el enlace muestra "Cuenta ya activada"
//  · variantes operativo y admin (color del nombre ahora gold-text, OBS-2)
// Uso: node driver-6-activar-reload.js <tokenOperativo> <tokenAdmin>
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const TOKEN_OP = process.argv[2];
const TOKEN_ADMIN = process.argv[3];

(async () => {
  const browser = await chromium.launch();
  const fallos = [];
  const ok = (cond, msg) => {
    console.log(`${cond ? "PASS" : "FAIL"} — ${msg}`);
    if (!cond) fallos.push(msg);
  };

  const probar = async (token, esAdmin, titulo, nombre, shot) => {
    const rol = esAdmin ? "admin" : "operativo";
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/activar?token=${token}`);
    await page.getByLabel("Nueva contraseña").fill("Prueba1234!");
    await page.getByLabel("Confirmar contraseña").fill("Prueba1234!");
    await page.getByRole("button", { name: "Activar y entrar" }).click();
    await page.waitForTimeout(2500);
    ok(await page.getByText(titulo).isVisible(), `${rol}: bienvenida visible tras activar`);
    ok(await page.getByText(nombre).isVisible(), `${rol}: nombre en la bienvenida`);

    // OBS-1: recarga → la bienvenida debe seguir ahí (sessionStorage)
    await page.reload();
    await page.waitForTimeout(2000);
    ok(await page.getByText(titulo).isVisible(), `${rol}: la bienvenida SOBREVIVE a la recarga (OBS-1)`);
    ok(
      await page.getByRole("button", { name: "Empezar" }).isVisible(),
      `${rol}: botón Empezar disponible tras recargar`,
    );
    await page.screenshot({ path: `${SHOTS}/${shot}` });

    await page.getByRole("button", { name: "Empezar" }).click();
    await page.waitForURL("**/inicio", { timeout: 20000 });
    ok(page.url().endsWith("/inicio"), `${rol}: Empezar lleva a /inicio con sesión`);

    // Tras Empezar se limpia la persistencia: el enlace vuelve a su estado real
    await page.goto(`${BASE}/activar?token=${token}`);
    await page.waitForTimeout(2000);
    ok(
      await page.getByText("Cuenta ya activada").isVisible(),
      `${rol}: tras Empezar, revisitar el enlace muestra "Cuenta ya activada"`,
    );
    await ctx.close();
  };

  const NOMBRE_OP = process.env.NOMBRE_OP || "Rocío Prueba";
  await probar(TOKEN_OP, false, "¡Te damos la bienvenida,", NOMBRE_OP, "d6-bienvenida-op-reload.png");
  if (TOKEN_ADMIN) await probar(TOKEN_ADMIN, true, "¡Todo listo,", "Aída Prueba", "d6-bienvenida-admin-reload.png");

  await browser.close();
  if (fallos.length) {
    console.error(`\n${fallos.length} fallo(s)`);
    process.exit(1);
  }
  console.log("\nDriver 6 OK");
})();
