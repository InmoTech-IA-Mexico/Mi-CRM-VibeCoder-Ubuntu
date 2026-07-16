// Driver 2 — Activación con paso de bienvenida (JUA-8/9 follow-up):
//  a) operativo (Verónica): activa → bienvenida verde → Empezar → /inicio
//  b) admin (Alberto): activa (zona CDMX, sin tocar el nombre) → bienvenida dorada → Empezar → /inicio
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

  const activar = async (token, esAdmin, shotPrefix) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/activar?token=${token}`);
    await page.getByLabel("Nueva contraseña").fill("Prueba1234!");
    await page.getByLabel("Confirmar contraseña").fill("Prueba1234!");
    if (esAdmin) {
      // La zona por defecto ya es America/Mexico_City (la del negocio demo);
      // el nombre del negocio se deja tal cual viene prefijado.
      ok(
        (await page.getByLabel("Zona horaria del negocio").inputValue()) === "America/Mexico_City",
        "admin: zona por defecto = America/Mexico_City (no altera el negocio demo)",
      );
    }
    await page.getByRole("button", { name: "Activar y entrar" }).click();
    await page.waitForTimeout(2500);
    return { ctx, page };
  };

  // a) Operativo
  {
    const { ctx, page } = await activar(TOKEN_OP, false, "op");
    ok(
      await page.getByText("¡Te damos la bienvenida,").isVisible(),
      "operativo: título de bienvenida visible",
    );
    ok(await page.getByText("Verónica Prueba").isVisible(), "operativo: nombre en la bienvenida");
    ok(
      await page.getByText("Ya puedes empezar a gestionar tus clientes.").isVisible(),
      "operativo: texto de bienvenida",
    );
    await page.screenshot({ path: `${SHOTS}/d2-bienvenida-operativo.png` });
    await page.getByRole("button", { name: "Empezar" }).click();
    await page.waitForURL("**/inicio", { timeout: 20000 });
    await page.waitForTimeout(2000);
    ok(page.url().endsWith("/inicio"), "operativo: Empezar lleva a /inicio con sesión");
    await page.screenshot({ path: `${SHOTS}/d2-inicio-operativo.png` });
    await ctx.close();
  }

  // b) Admin
  {
    const { ctx, page } = await activar(TOKEN_ADMIN, true, "admin");
    ok(await page.getByText("¡Todo listo,").isVisible(), "admin: título de bienvenida visible");
    ok(await page.getByText("Alberto Prueba").isVisible(), "admin: nombre en la bienvenida");
    ok(
      await page.getByText(/Tu negocio .* está configurado/).isVisible(),
      "admin: texto con el negocio configurado",
    );
    await page.screenshot({ path: `${SHOTS}/d2-bienvenida-admin.png` });
    await page.getByRole("button", { name: "Empezar" }).click();
    await page.waitForURL("**/inicio", { timeout: 20000 });
    ok(page.url().endsWith("/inicio"), "admin: Empezar lleva a /inicio con sesión");
    await ctx.close();
  }

  await browser.close();
  if (fallos.length) {
    console.error(`\n${fallos.length} fallo(s)`);
    process.exit(1);
  }
  console.log("\nDriver 2 OK");
})();
