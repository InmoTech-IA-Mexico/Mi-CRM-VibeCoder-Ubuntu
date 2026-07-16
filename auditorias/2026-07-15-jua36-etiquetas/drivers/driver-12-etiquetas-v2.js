// Driver 12 — JUA-36 Etiquetas de producto · v2 (obs. OBS-2/OBS-3 del dictamen):
//  · nombres ÚNICOS por corrida (reproducible, sin depender del residuo previo)
//  · vigila pageerror y console.error (falla ante errores no esperados)
//  · estructura = pasos 2-9 de la "verificación mínima en producción" del dictamen
// Uso: node driver-12-etiquetas-v2.js <clienteId> [sufijo]
//   (sufijo por defecto: HHMMSS — evita colisiones entre corridas)
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const CLIENTE = process.argv[2];
const SUFIJO = process.argv[3] || new Date().toISOString().slice(11, 19).replace(/:/g, "");
const ETQ1 = `QA-Formación-${SUFIJO}`;
const ETQ2 = `QA-Consultoría-${SUFIJO}`;
const ETQ1_REN = `QA-Cursos-${SUFIJO}`;

// Errores de navegador ESPERADOS (validación de negocio del paso 3 y su registro).
// En PRODUCCIÓN el cliente de Convex loguea el ConvexError esperado de crear como
// "[CONVEX M(etiquetas:crear)] … Server Error" (mensaje enmascarado): se acepta
// SOLO esa mutación, que es la única que el driver rechaza a propósito.
const ERRORES_ESPERADOS = [
  /Ya existe una etiqueta con ese nombre/,
  /No se pudo crear la etiqueta/,
  /\[CONVEX M\(etiquetas:crear\)\]/,
];

(async () => {
  const browser = await chromium.launch();
  const fallos = [];
  const erroresNavegador = [];
  const ok = (cond, msg) => {
    console.log(`${cond ? "PASS" : "FAIL"} — ${msg}`);
    if (!cond) fallos.push(msg);
  };

  const vigilar = (page, rol) => {
    page.on("pageerror", (err) => {
      if (!ERRORES_ESPERADOS.some((re) => re.test(String(err)))) {
        erroresNavegador.push(`[${rol}] pageerror: ${String(err).slice(0, 200)}`);
      }
    });
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const texto = msg.text();
      // El overlay de dev de Next repite los errores de red/HMR; solo nos
      // interesan los de la app que no estén en la lista de esperados.
      if (!ERRORES_ESPERADOS.some((re) => re.test(texto))) {
        erroresNavegador.push(`[${rol}] console.error: ${texto.slice(0, 200)}`);
      }
    });
  };

  const login = async (email, pass, rol) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    vigilar(page, rol);
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder("nombre@empresa.mx").fill(email);
    await page.getByPlaceholder("••••••••").fill(pass);
    await page.getByRole("button", { name: /Entrar/i }).click();
    await page.waitForURL("**/inicio", { timeout: 20000 });
    return { ctx, page };
  };

  // ===== Pasos 2-5 y 7-9 como Marta (admin) =====
  const { ctx: ctxA, page: pa } = await login("marta@demo.mx", "Marta1234", "admin");

  // Paso 2: los clientes existentes sin etiquetas siguen listándose y abriendo
  await pa.goto(`${BASE}/clientes`);
  await pa.waitForTimeout(2000);
  ok((await pa.locator("a[href^='/clientes/j']").count()) > 0, "2: la lista de clientes carga");
  await pa.goto(`${BASE}/clientes/${CLIENTE}`);
  await pa.waitForTimeout(2000);
  ok(
    await pa.getByLabel("Editar etiquetas de producto").isVisible(),
    "2: la ficha abre y muestra la fila de etiquetas",
  );

  // Paso 3: crear 2 etiquetas QA + duplicado con otra capitalización rechazado
  await pa.goto(`${BASE}/etiquetas`);
  await pa.waitForTimeout(1500);
  const crear = async (nombre) => {
    await pa.getByLabel("Nombre de la nueva etiqueta").fill(nombre);
    await pa.getByLabel("Crear etiqueta").click();
    await pa.waitForTimeout(1200);
  };
  await crear(ETQ1);
  await crear(ETQ2);
  ok(await pa.getByText(ETQ1, { exact: true }).isVisible(), "3: etiqueta QA 1 creada");
  ok(await pa.getByText(ETQ2, { exact: true }).isVisible(), "3: etiqueta QA 2 creada");
  await crear(ETQ1.toUpperCase());
  ok(
    await pa.getByText("Ya existe una etiqueta con ese nombre", { exact: true }).isVisible(),
    "3: duplicado con distinta capitalización rechazado con motivo visible",
  );
  await pa.screenshot({ path: `${SHOTS}/d12-gestion.png` });

  // Paso 4: asignar ambas al cliente QA → chips en la ficha
  await pa.goto(`${BASE}/clientes/${CLIENTE}`);
  await pa.waitForTimeout(2000);
  await pa.getByLabel("Editar etiquetas de producto").click();
  await pa.waitForTimeout(600);
  await pa.getByRole("button", { name: ETQ1, exact: true }).click();
  await pa.getByRole("button", { name: ETQ2, exact: true }).click();
  await pa.getByRole("button", { name: "Guardar etiquetas" }).click();
  await pa.waitForTimeout(1500);
  ok(
    (await pa.getByText(ETQ1, { exact: true }).isVisible()) &&
      (await pa.getByText(ETQ2, { exact: true }).isVisible()),
    "4: la ficha muestra los chips de ambas etiquetas",
  );
  await pa.screenshot({ path: `${SHOTS}/d12-ficha.png` });

  // Paso 5: filtrar por etiqueta (conteo 1) y combinar con el buscador
  await pa.goto(`${BASE}/clientes`);
  await pa.waitForTimeout(2000);
  const chip1 = pa.getByRole("button", { name: new RegExp(ETQ1) });
  ok(await chip1.isVisible(), "5: chip de la etiqueta QA 1 visible con conteo");
  await chip1.click();
  await pa.waitForTimeout(800);
  ok(
    (await pa.locator("a[href^='/clientes/j']").count()) === 1,
    "5: el filtro deja exactamente 1 cliente",
  );
  await pa.screenshot({ path: `${SHOTS}/d12-lista.png` });
  await pa.getByLabel("Buscar clientes").fill("zzz-sin-resultado");
  await pa.waitForTimeout(800);
  ok(await pa.getByText(/No encontramos/).isVisible(), "5: combinable con el buscador");
  await pa.getByLabel("Limpiar búsqueda").click();

  // ===== Paso 6 como Carlos (operativo) =====
  const { ctx: ctxB, page: pc } = await login("carlos@demo.mx", "Carlos1234", "operativo");
  await pc.goto(`${BASE}/clientes/${CLIENTE}`);
  await pc.waitForTimeout(2000);
  await pc.getByLabel("Editar etiquetas de producto").click();
  await pc.waitForTimeout(600);
  ok(
    !(await pc.getByLabel("Nombre de la nueva etiqueta").isVisible().catch(() => false)),
    "6: el operativo NO ve el campo de crear etiqueta",
  );
  await pc.getByRole("button", { name: ETQ2, exact: true }).click(); // la quita
  await pc.getByRole("button", { name: "Guardar etiquetas" }).click();
  await pc.waitForTimeout(1500);
  ok(
    !(await pc.getByText(ETQ2, { exact: true }).isVisible().catch(() => false)),
    "6: el operativo pudo quitar una etiqueta",
  );
  await pc.goto(`${BASE}/etiquetas`);
  await pc.waitForURL("**/inicio", { timeout: 15000 });
  ok(true, "6: /etiquetas redirige al operativo a /inicio");
  await ctxB.close();

  // ===== Paso 7: renombrar una etiqueta ASIGNADA conserva la asignación =====
  await pa.goto(`${BASE}/etiquetas`);
  await pa.waitForTimeout(1500);
  await pa.getByLabel(`Renombrar ${ETQ1}`).click();
  await pa.waitForTimeout(600);
  await pa.getByLabel("Nuevo nombre de la etiqueta").fill(ETQ1_REN);
  await pa.getByRole("button", { name: "Guardar nombre" }).click();
  await pa.waitForTimeout(1200);
  ok(await pa.getByText(ETQ1_REN, { exact: true }).isVisible(), "7: renombrada en el catálogo");
  await pa.goto(`${BASE}/clientes/${CLIENTE}`);
  await pa.waitForTimeout(2000);
  ok(
    await pa.getByText(ETQ1_REN, { exact: true }).isVisible(),
    "7: la ficha conserva la asignación con el nombre nuevo (filtra por id)",
  );

  // ===== Paso 8: eliminar la etiqueta asignada limpia catálogo y ficha =====
  await pa.goto(`${BASE}/etiquetas`);
  await pa.waitForTimeout(1500);
  await pa.getByLabel(`Eliminar ${ETQ1_REN}`).click();
  await pa.waitForTimeout(600);
  ok(await pa.getByText(/se quitará de 1 cliente/).isVisible(), "8: confirmación avisa del alcance");
  await pa.getByRole("button", { name: "Eliminar", exact: true }).click();
  await pa.waitForTimeout(1500);
  ok(
    !(await pa.getByText(ETQ1_REN, { exact: true }).isVisible().catch(() => false)),
    "8: eliminada del catálogo",
  );
  await pa.goto(`${BASE}/clientes/${CLIENTE}`);
  await pa.waitForTimeout(2000);
  ok(
    !(await pa.getByText(ETQ1_REN, { exact: true }).isVisible().catch(() => false)),
    "8: la ficha ya no muestra el chip",
  );

  // ===== Paso 9: limpiar datos QA (elimina la 2ª etiqueta, ya sin clientes) =====
  await pa.goto(`${BASE}/etiquetas`);
  await pa.waitForTimeout(1500);
  await pa.getByLabel(`Eliminar ${ETQ2}`).click();
  await pa.waitForTimeout(600);
  await pa.getByRole("button", { name: "Eliminar", exact: true }).click();
  await pa.waitForTimeout(1500);
  ok(
    !(await pa.getByText(ETQ2, { exact: true }).isVisible().catch(() => false)),
    "9: datos QA limpiados (catálogo sin residuo de esta corrida)",
  );
  await ctxA.close();

  await browser.close();

  // OBS-3: errores de navegador no esperados hacen fallar la corrida.
  if (erroresNavegador.length) {
    console.error(`\nErrores de navegador NO esperados (${erroresNavegador.length}):`);
    for (const e of erroresNavegador) console.error("  " + e);
    fallos.push("errores de navegador inesperados");
  } else {
    console.log("PASS — sin pageerror ni console.error inesperados en toda la corrida");
  }

  if (fallos.length) {
    console.error(`\n${fallos.length} fallo(s)`);
    process.exit(1);
  }
  console.log("\nDriver 12 OK");
})();
