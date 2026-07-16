// Driver 13 — JUA-36 Etiquetas de producto · v3 (dictamen v2: DOC-2 + sugerencias OBS-2/3)
// Cambios sobre v2:
//  · sufijo ALEATORIO (sin colisiones entre corridas simultáneas)
//  · limpieza de datos QA en `finally` (se ejecuta aunque una aserción/excepción interrumpa)
//  · aserciones nuevas: el FILTRO de la lista conserva la asignación tras renombrar (paso 7b)
//    y desaparece tras eliminar (paso 8c)
//  · reporte durable (texto) con fecha, base URL, sufijo, resultados y errores de navegador
//  · registra `requestfailed` como informativo en el reporte (no hace fallar la corrida)
// Uso: node driver-13-etiquetas-v3.js <clienteId> [rutaReporte]
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const CLIENTE = process.argv[2];
const REPORTE = process.argv[3] || `${SHOTS}/reporte-etiquetas-v3.txt`;
const SUFIJO = Math.random().toString(36).slice(2, 8);
const ETQ1 = `QA-Formación-${SUFIJO}`;
const ETQ2 = `QA-Consultoría-${SUFIJO}`;
const ETQ1_REN = `QA-Cursos-${SUFIJO}`;

const ERRORES_ESPERADOS = [
  /Ya existe una etiqueta con ese nombre/,
  /No se pudo crear la etiqueta/,
  /\[CONVEX M\(etiquetas:crear\)\]/, // forma enmascarada en producción del rechazo esperado
];

(async () => {
  const browser = await chromium.launch();
  const resultados = [];
  const fallos = [];
  const erroresNavegador = [];
  const requestsFallidas = [];
  const ok = (cond, msg) => {
    const linea = `${cond ? "PASS" : "FAIL"} — ${msg}`;
    console.log(linea);
    resultados.push(linea);
    if (!cond) fallos.push(msg);
  };
  // Espera explícita para aserciones positivas tras una navegación: isVisible()
  // se evalúa al instante y en producción la carga puede superar la pausa fija.
  const visible = (locator, timeout = 15000) =>
    locator.waitFor({ state: "visible", timeout }).then(() => true).catch(() => false);

  const vigilar = (page, rol) => {
    page.on("pageerror", (err) => {
      if (!ERRORES_ESPERADOS.some((re) => re.test(String(err)))) {
        erroresNavegador.push(`[${rol}] pageerror: ${String(err).slice(0, 200)}`);
      }
    });
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const texto = msg.text();
      if (!ERRORES_ESPERADOS.some((re) => re.test(texto))) {
        erroresNavegador.push(`[${rol}] console.error: ${texto.slice(0, 200)}`);
      }
    });
    // Informativo (no bloquea): fallos de red/recursos que no pasan por consola.
    page.on("requestfailed", (req) => {
      requestsFallidas.push(`[${rol}] ${req.failure()?.errorText ?? "?"} ${req.url().slice(0, 120)}`);
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

  // Limpieza recuperable (OBS-2): borra cualquier etiqueta QA de ESTA corrida que
  // siga existiendo, en cualquier estado intermedio en que haya quedado el flujo.
  const limpiar = async (pa) => {
    for (const nombre of [ETQ1, ETQ1_REN, ETQ2]) {
      try {
        await pa.goto(`${BASE}/etiquetas`);
        await pa.waitForTimeout(1200);
        const boton = pa.getByLabel(`Eliminar ${nombre}`);
        if (await boton.isVisible().catch(() => false)) {
          await boton.click();
          await pa.waitForTimeout(500);
          await pa.getByRole("button", { name: "Eliminar", exact: true }).click();
          await pa.waitForTimeout(1200);
        }
      } catch {
        // La limpieza no debe tapar el error original de la corrida.
      }
    }
  };

  const { ctx: ctxA, page: pa } = await login("marta@demo.mx", "Marta1234", "admin");
  try {
    // Paso 2: clientes existentes siguen listando/abriendo
    await pa.goto(`${BASE}/clientes`);
    await pa.waitForTimeout(2000);
    ok((await pa.locator("a[href^='/clientes/j']").count()) > 0, "2: la lista de clientes carga");
    await pa.goto(`${BASE}/clientes/${CLIENTE}`);
    await pa.waitForTimeout(2000);
    ok(await visible(pa.getByLabel("Editar etiquetas de producto")), "2: la ficha abre y muestra la fila de etiquetas");

    // Paso 3: crear 2 + duplicado con otra capitalización rechazado
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

    // Paso 4: asignar ambas al cliente QA
    await pa.goto(`${BASE}/clientes/${CLIENTE}`);
    await pa.waitForTimeout(2000);
    await pa.getByLabel("Editar etiquetas de producto").click();
    await pa.waitForTimeout(600);
    await pa.getByRole("button", { name: ETQ1, exact: true }).click();
    await pa.getByRole("button", { name: ETQ2, exact: true }).click();
    await pa.getByRole("button", { name: "Guardar etiquetas" }).click();
    await pa.waitForTimeout(1500);
    ok(
      (await visible(pa.getByText(ETQ1, { exact: true }))) &&
        (await pa.getByText(ETQ2, { exact: true }).isVisible()),
      "4: la ficha muestra los chips de ambas etiquetas",
    );

    // Paso 5: filtro + combinación con búsqueda
    await pa.goto(`${BASE}/clientes`);
    await pa.waitForTimeout(2000);
    const chip1 = pa.getByRole("button", { name: new RegExp(ETQ1) });
    ok(await chip1.isVisible(), "5: chip de la etiqueta QA 1 visible con conteo");
    await chip1.click();
    await pa.waitForTimeout(800);
    ok((await pa.locator("a[href^='/clientes/j']").count()) === 1, "5: el filtro deja exactamente 1 cliente");
    await pa.getByLabel("Buscar clientes").fill("zzz-sin-resultado");
    await pa.waitForTimeout(800);
    ok(await pa.getByText(/No encontramos/).isVisible(), "5: combinable con el buscador");
    await pa.getByLabel("Limpiar búsqueda").click();

    // Paso 6: operativo
    const { ctx: ctxB, page: pc } = await login("carlos@demo.mx", "Carlos1234", "operativo");
    await pc.goto(`${BASE}/clientes/${CLIENTE}`);
    await pc.waitForTimeout(2000);
    await pc.getByLabel("Editar etiquetas de producto").click();
    await pc.waitForTimeout(600);
    ok(
      !(await pc.getByLabel("Nombre de la nueva etiqueta").isVisible().catch(() => false)),
      "6: el operativo NO ve el campo de crear etiqueta",
    );
    await pc.getByRole("button", { name: ETQ2, exact: true }).click();
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

    // Paso 7: renombrar ASIGNADA conserva asignación (ficha Y filtro — DOC-2)
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
    ok(await visible(pa.getByText(ETQ1_REN, { exact: true })), "7: la ficha conserva la asignación con el nombre nuevo");
    await pa.goto(`${BASE}/clientes`);
    await pa.waitForTimeout(2000);
    const chipRen = pa.getByRole("button", { name: new RegExp(ETQ1_REN) });
    ok(await chipRen.isVisible(), "7b: el FILTRO muestra el chip con el nombre nuevo (DOC-2)");
    await chipRen.click();
    await pa.waitForTimeout(800);
    ok(
      (await pa.locator("a[href^='/clientes/j']").count()) === 1,
      "7b: filtrar por la etiqueta renombrada conserva la asignación (por id)",
    );

    // Paso 8: eliminar ASIGNADA limpia catálogo, ficha Y filtro (DOC-2)
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
    await pa.goto(`${BASE}/clientes`);
    await pa.waitForTimeout(2000);
    ok(
      !(await pa.getByRole("button", { name: new RegExp(ETQ1_REN) }).isVisible().catch(() => false)),
      "8c: el FILTRO ya no ofrece la etiqueta eliminada (DOC-2)",
    );

    // Paso 9: limpiar la 2ª etiqueta (el finally re-verifica y barre lo que quede)
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
  } finally {
    await limpiar(pa); // OBS-2: saneamiento aunque la corrida se interrumpa
    await ctxA.close().catch(() => {});
  }

  await browser.close();

  if (erroresNavegador.length) {
    console.error(`\nErrores de navegador NO esperados (${erroresNavegador.length}):`);
    for (const e of erroresNavegador) console.error("  " + e);
    fallos.push("errores de navegador inesperados");
  } else {
    const linea = "PASS — sin pageerror ni console.error inesperados en toda la corrida";
    console.log(linea);
    resultados.push(linea);
  }

  // DOC-3: reporte durable de la corrida (sin tokens ni contraseñas).
  const reporte = [
    "Reporte driver-13 etiquetas v3 (JUA-36)",
    `fecha: ${new Date().toISOString()}`,
    `baseUrl: ${BASE}`,
    `clienteId: ${CLIENTE}`,
    `sufijo QA: ${SUFIJO}`,
    `resultado: ${fallos.length === 0 ? "OK" : "CON FALLOS"} (${resultados.filter((r) => r.startsWith("PASS")).length} PASS / ${fallos.length} FAIL)`,
    "",
    ...resultados,
    "",
    `errores de navegador no esperados: ${erroresNavegador.length}`,
    ...erroresNavegador.map((e) => "  " + e),
    `requestfailed (informativo, no bloquea): ${requestsFallidas.length}`,
    ...requestsFallidas.slice(0, 10).map((e) => "  " + e),
  ].join("\n");
  fs.writeFileSync(REPORTE, reporte + "\n");
  console.log(`\nReporte guardado en ${REPORTE}`);

  if (fallos.length) {
    console.error(`\n${fallos.length} fallo(s)`);
    process.exit(1);
  }
  console.log("Driver 13 OK");
})();
