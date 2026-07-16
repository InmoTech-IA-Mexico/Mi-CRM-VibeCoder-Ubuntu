// Driver 15 — JUA-125 remediación (dictamen v1 NO-GO → criterios 2, 4 y 5):
//  · ciclo nominal: inactivo → enlace → contraseña nueva → login → uso único → revocación inmediata
//  · enlace perdido: cerrar la hoja SIN usar el enlace → la tarjeta ofrece "Nuevo enlace" →
//    regenerar INVALIDA el token anterior y el nuevo funciona (B-2)
//  · sin pageerror/console.error inesperados; limpieza en finally; reporte con tokens REDACTADOS
// Credenciales por env: ADMIN_EMAIL/ADMIN_PASS. Uso: node driver-15-hardening-v2.js <emailQA> <nombreQA> [rutaReporte]
const { chromium } = require("playwright");
const fs = require("fs");
const crypto = require("crypto");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "marta@demo.mx";
const ADMIN_PASS = process.env.ADMIN_PASS;
const [EMAIL, NOMBRE, RUTA_REPORTE] = process.argv.slice(2);
const REPORTE = RUTA_REPORTE || `${SHOTS}/reporte-hardening-v2.txt`;
const NUEVA = "Qa-" + crypto.randomBytes(9).toString("base64url");

(async () => {
  if (!ADMIN_PASS) throw new Error("Falta ADMIN_PASS en el entorno");
  const browser = await chromium.launch();
  const resultados = [];
  const fallos = [];
  const erroresNavegador = [];
  let excepcion = null;
  const ok = (cond, msg) => {
    const linea = `${cond ? "PASS" : "FAIL"} — ${msg}`;
    console.log(linea);
    resultados.push(linea);
    if (!cond) fallos.push(msg);
  };
  const visible = (locator, timeout = 15000) =>
    locator.waitFor({ state: "visible", timeout }).then(() => true).catch(() => false);
  const vigilar = (page, rol) => {
    page.on("pageerror", (err) => erroresNavegador.push(`[${rol}] pageerror: ${String(err).slice(0, 200)}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") erroresNavegador.push(`[${rol}] console.error: ${msg.text().slice(0, 200)}`);
    });
  };

  const ctxA = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const pa = await ctxA.newPage();
  vigilar(pa, "admin");
  const ctxU = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pu = await ctxU.newPage();
  vigilar(pu, "usuario");

  const tarjeta = () => pa.locator("div.rounded-2xl").filter({ hasText: NOMBRE }).first();
  const leerEnlaceDeHoja = async () => {
    await pa.getByRole("button", { name: "Copiar enlace de nueva contraseña" }).click();
    await visible(pa.getByText("Enlace copiado"));
    const enlace = await pa.evaluate(() => navigator.clipboard.readText());
    await pa.getByRole("button", { name: "Entendido" }).click();
    await pa.waitForTimeout(800);
    return enlace;
  };

  try {
    // Admin entra y reactiva al QA inactivo
    await pa.goto(`${BASE}/login`);
    await pa.getByPlaceholder("nombre@empresa.mx").fill(ADMIN_EMAIL);
    await pa.getByPlaceholder("••••••••").fill(ADMIN_PASS);
    await pa.getByRole("button", { name: /Entrar/i }).click();
    await pa.waitForURL("**/inicio", { timeout: 20000 });
    await pa.goto(`${BASE}/usuarios`);
    await pa.waitForTimeout(1500);

    await tarjeta().getByRole("button", { name: "Reactivar" }).click();
    ok(await visible(pa.getByText("Usuario reactivado")), "reactivar abre la hoja con el enlace");
    ok(
      await pa.getByText(/pulsa .*Nuevo enlace.* en su\s+tarjeta/s).isVisible(),
      "el copy indica la ruta real de regeneración (Nuevo enlace)",
    );
    const enlace1 = await leerEnlaceDeHoja();
    ok(/\/nueva-password\?token=[0-9a-f]{64}$/.test(enlace1), "primer enlace copiado (hoja cerrada después)");

    // B-2: la tarjeta del usuario Activo SIN contraseña ofrece "Nuevo enlace"
    ok(
      await visible(tarjeta().getByRole("button", { name: "Nuevo enlace" })),
      "la tarjeta (activo, enlace pendiente) ofrece 'Nuevo enlace'",
    );
    await pa.screenshot({ path: `${SHOTS}/d15-nuevo-enlace.png` });
    await tarjeta().getByRole("button", { name: "Nuevo enlace" }).click();
    ok(await visible(pa.getByText("Usuario reactivado")), "regenerar reabre la hoja");
    const enlace2 = await leerEnlaceDeHoja();
    ok(enlace2 !== enlace1 && /token=[0-9a-f]{64}$/.test(enlace2), "el enlace regenerado es distinto");

    // Criterio 5: el token anterior queda inválido; el nuevo funciona
    await pu.goto(enlace1);
    ok(await visible(pu.getByText("Enlace no válido")), "el enlace ANTERIOR quedó inválido tras regenerar");
    await pu.goto(enlace2);
    ok(await visible(pu.getByLabel("Nueva contraseña")), "el enlace NUEVO abre el formulario");

    // Criterio 4: contraseña nueva → login → sesión viva
    await pu.getByLabel("Nueva contraseña").fill(NUEVA);
    await pu.getByLabel("Confirmar contraseña").fill(NUEVA);
    await pu.getByRole("button", { name: "Guardar contraseña" }).click();
    await pu.waitForURL("**/login?reset=1", { timeout: 20000 });
    await pu.getByPlaceholder("nombre@empresa.mx").fill(EMAIL);
    await pu.getByPlaceholder("••••••••").fill(NUEVA);
    await pu.getByRole("button", { name: /Entrar/i }).click();
    await pu.waitForURL("**/inicio", { timeout: 20000 });
    ok(true, "el usuario fija su contraseña y entra (sesión viva)");

    // Uso único
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2 = await ctx2.newPage();
    vigilar(p2, "reuso");
    await p2.goto(enlace2);
    ok(await visible(p2.getByText("Enlace ya utilizado")), "reusar el enlace da 'Enlace ya utilizado'");
    await ctx2.close();

    // Con contraseña fijada, la tarjeta ya NO ofrece 'Nuevo enlace'
    await pa.reload();
    await pa.waitForTimeout(1500);
    ok(
      !(await tarjeta().getByRole("button", { name: "Nuevo enlace" }).isVisible().catch(() => false)),
      "con contraseña fijada desaparece 'Nuevo enlace' (solo Revocar)",
    );

    // Revocación inmediata: la sesión viva muere
    await tarjeta().getByRole("button", { name: "Revocar" }).click();
    ok(await visible(tarjeta().getByRole("button", { name: "Reactivar" })), "revocado: vuelve a Reactivar");
    await pu.reload();
    await pu.waitForURL("**/login**", { timeout: 20000 });
    ok(true, "la sesión viva del revocado muere al instante (cae en /login)");
  } catch (e) {
    excepcion = e;
  } finally {
    // Limpieza recuperable: el QA debe quedar INACTIVO pase lo que pase, y el
    // resultado del saneamiento se registra (OBS-2): un fallo cuenta como FAIL.
    try {
      await pa.goto(`${BASE}/usuarios`);
      await pa.waitForTimeout(1500);
      const revocar = tarjeta().getByRole("button", { name: "Revocar" });
      if (await revocar.isVisible().catch(() => false)) {
        await revocar.click();
        await pa.waitForTimeout(1200);
      }
      const inactivo = await tarjeta().getByRole("button", { name: "Reactivar" }).isVisible().catch(() => false);
      ok(inactivo, "cleanup: el QA queda inactivo (Reactivar disponible)");
    } catch (e) {
      ok(false, `cleanup: fallo al sanear (${String(e).slice(0, 120)})`);
    }
    await ctxA.close().catch(() => {});
    await ctxU.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  if (excepcion) {
    const linea = `FAIL — excepción no controlada: ${String(excepcion).slice(0, 300)}`;
    console.error(linea);
    resultados.push(linea);
    fallos.push("excepción no controlada");
  }
  if (erroresNavegador.length) {
    console.error(`Errores de navegador NO esperados (${erroresNavegador.length}):`);
    for (const e of erroresNavegador) console.error("  " + e);
    fallos.push("errores de navegador inesperados");
  } else {
    const linea = "PASS — sin pageerror ni console.error inesperados en toda la corrida";
    console.log(linea);
    resultados.push(linea);
  }

  // Reporte durable (OBS-1: sin sección de tokens — ninguno se persiste).
  fs.writeFileSync(
    REPORTE,
    [
      "Reporte driver-15 hardening v2 (JUA-125)",
      `fecha: ${new Date().toISOString()}`,
      `baseUrl: ${BASE}`,
      `usuarioQA: ${EMAIL}`,
      `resultado: ${fallos.length === 0 ? "OK" : "CON FALLOS"} (${resultados.filter((r) => r.startsWith("PASS")).length} PASS / ${fallos.length} FAIL)`,
      "tokens no persistidos; contraseña QA aleatoria y efímera.",
      "",
      ...resultados,
      "",
      `errores de navegador no esperados: ${erroresNavegador.length}`,
      ...erroresNavegador.map((e) => "  " + e),
    ].join("\n") + "\n",
  );
  console.log(`\nReporte guardado en ${REPORTE}`);
  process.exit(fallos.length ? 1 : 0);
})();
