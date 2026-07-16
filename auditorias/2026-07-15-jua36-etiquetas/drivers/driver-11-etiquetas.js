// Driver 11 — JUA-36 Etiquetas de producto (E2E, dev):
//  A) admin: gestión en /etiquetas (crear x2, duplicado rechazado, renombrar) + acceso desde perfil
//  B) admin: asignar 2 etiquetas a Ana García desde la ficha → chips visibles
//  C) filtro por etiqueta en la lista (combinable con búsqueda)
//  D) operativo: puede asignar/quitar pero NO crear; /etiquetas le redirige a /inicio
//  E) admin: eliminar etiqueta asignada → desaparece de catálogo, ficha y lista
// Uso: node driver-11-etiquetas.js <clienteIdAna>
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const ANA = process.argv[2];

(async () => {
  const browser = await chromium.launch();
  const fallos = [];
  const ok = (cond, msg) => {
    console.log(`${cond ? "PASS" : "FAIL"} — ${msg}`);
    if (!cond) fallos.push(msg);
  };

  const login = async (email, pass) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder("nombre@empresa.mx").fill(email);
    await page.getByPlaceholder("••••••••").fill(pass);
    await page.getByRole("button", { name: /Entrar/i }).click();
    await page.waitForURL("**/inicio", { timeout: 20000 });
    return { ctx, page };
  };

  // ============ A) Admin: gestión ============
  const { ctx: ctxA, page: pa } = await login("marta@demo.mx", "Marta1234");

  await pa.goto(`${BASE}/perfil`);
  await pa.waitForTimeout(1500);
  const acceso = pa.getByRole("link", { name: /Etiquetas de producto/ });
  ok(await acceso.isVisible(), "A: el perfil (accesos admin) muestra 'Etiquetas de producto'");
  await acceso.click();
  await pa.waitForURL("**/etiquetas", { timeout: 15000 });
  await pa.waitForTimeout(1200);

  const crear = async (nombre) => {
    await pa.getByLabel("Nombre de la nueva etiqueta").fill(nombre);
    await pa.getByLabel("Crear etiqueta").click();
    await pa.waitForTimeout(1200);
  };
  // Idempotente: solo crea si no existe de una corrida previa.
  if (!(await pa.getByText("Formación", { exact: true }).isVisible().catch(() => false))) {
    await crear("Formación");
  }
  if (
    !(await pa.getByText("Consultoría", { exact: true }).isVisible().catch(() => false)) &&
    !(await pa.getByText("Consultoría Premium", { exact: true }).isVisible().catch(() => false))
  ) {
    await crear("Consultoría");
  }
  ok(await pa.getByText("Formación", { exact: true }).isVisible(), "A: 'Formación' creada y listada");
  ok(await pa.getByText("Consultoría", { exact: true }).isVisible(), "A: 'Consultoría' creada y listada");

  await crear("formación"); // duplicado (sin distinguir mayúsculas)
  ok(
    await pa.getByText("Ya existe una etiqueta con ese nombre", { exact: true }).isVisible(),
    "A: duplicado rechazado con motivo visible",
  );

  if (await pa.getByText("Consultoría Premium", { exact: true }).isVisible().catch(() => false)) {
    console.log("SKIP — 'Consultoría' ya renombrada en corrida previa");
  } else {
  await pa.getByLabel("Renombrar Consultoría").click();
  await pa.waitForTimeout(600);
  await pa.getByLabel("Nuevo nombre de la etiqueta").fill("Consultoría Premium");
  await pa.getByRole("button", { name: "Guardar nombre" }).click();
  await pa.waitForTimeout(1200);
  }
  ok(await pa.getByText("Consultoría Premium", { exact: true }).isVisible(), "A: renombrar funciona");
  await pa.screenshot({ path: `${SHOTS}/d11-gestion-etiquetas.png` });

  // ============ B) Admin: asignar desde la ficha ============
  await pa.goto(`${BASE}/clientes/${ANA}`);
  await pa.waitForTimeout(2000);
  await pa.getByLabel("Editar etiquetas de producto").click();
  await pa.waitForTimeout(600);
  await pa.getByRole("button", { name: "Formación", exact: true }).click();
  await pa.getByRole("button", { name: "Consultoría Premium", exact: true }).click();
  await pa.getByRole("button", { name: "Guardar etiquetas" }).click();
  await pa.waitForTimeout(1500);
  ok(
    (await pa.getByText("Formación", { exact: true }).isVisible()) &&
      (await pa.getByText("Consultoría Premium", { exact: true }).isVisible()),
    "B: la ficha muestra los chips de las 2 etiquetas asignadas",
  );
  await pa.screenshot({ path: `${SHOTS}/d11-ficha-chips.png` });

  // ============ C) Filtro en la lista ============
  await pa.goto(`${BASE}/clientes`);
  await pa.waitForTimeout(2000);
  const chipFormacion = pa.getByRole("button", { name: /Formación/ });
  ok(await chipFormacion.isVisible(), "C: chip 'Formación' visible en la lista");
  await chipFormacion.click();
  await pa.waitForTimeout(800);
  const tarjetas = pa.locator("a[href*='/clientes/']").filter({ hasText: "Ana García" });
  ok(await tarjetas.first().isVisible(), "C: filtrando por 'Formación' aparece Ana García");
  const total = await pa.locator("a[href^='/clientes/j']").count();
  ok(total === 1, `C: solo 1 cliente con la etiqueta (hay ${total})`);
  await pa.screenshot({ path: `${SHOTS}/d11-lista-filtro.png` });

  // Combinable con el buscador: texto que no es Ana → 0 resultados
  await pa.getByLabel("Buscar clientes").fill("zzz-sin-resultado");
  await pa.waitForTimeout(800);
  ok(
    await pa.getByText(/No encontramos/).isVisible(),
    "C: filtro por etiqueta combinable con búsqueda (sin resultados)",
  );
  await ctxA.close();

  // ============ D) Operativo: asignar sí, crear no; /etiquetas redirige ============
  const { ctx: ctxB, page: pc } = await login("carlos@demo.mx", "Carlos1234");
  await pc.goto(`${BASE}/clientes/${ANA}`);
  await pc.waitForTimeout(2000);
  await pc.getByLabel("Editar etiquetas de producto").click();
  await pc.waitForTimeout(600);
  ok(
    !(await pc.getByLabel("Nombre de la nueva etiqueta").isVisible().catch(() => false)),
    "D: el operativo NO ve el campo de crear etiqueta",
  );
  await pc.getByRole("button", { name: "Consultoría Premium", exact: true }).click(); // la quita
  await pc.getByRole("button", { name: "Guardar etiquetas" }).click();
  await pc.waitForTimeout(1500);
  ok(
    !(await pc.getByText("Consultoría Premium", { exact: true }).isVisible().catch(() => false)),
    "D: el operativo pudo quitar una etiqueta (queda solo Formación)",
  );
  await pc.goto(`${BASE}/etiquetas`);
  await pc.waitForURL("**/inicio", { timeout: 15000 });
  ok(true, "D: /etiquetas redirige al operativo a /inicio (guard JUA-30)");
  await ctxB.close();

  // ============ E) Admin: eliminar etiqueta asignada ============
  const { ctx: ctxC, page: pe } = await login("marta@demo.mx", "Marta1234");
  await pe.goto(`${BASE}/etiquetas`);
  await pe.waitForTimeout(1500);
  await pe.getByLabel("Eliminar Formación").click();
  await pe.waitForTimeout(600);
  ok(
    await pe.getByText(/se quitará de 1 cliente/).isVisible(),
    "E: la confirmación avisa que se quitará de 1 cliente",
  );
  await pe.getByRole("button", { name: "Eliminar", exact: true }).click();
  await pe.waitForTimeout(1500);
  ok(
    !(await pe.getByText("Formación", { exact: true }).isVisible().catch(() => false)),
    "E: 'Formación' eliminada del catálogo",
  );
  await pe.goto(`${BASE}/clientes/${ANA}`);
  await pe.waitForTimeout(2000);
  ok(
    !(await pe.getByText("Formación", { exact: true }).isVisible().catch(() => false)),
    "E: la ficha de Ana ya no muestra el chip 'Formación'",
  );
  await ctxC.close();

  await browser.close();
  if (fallos.length) {
    console.error(`\n${fallos.length} fallo(s)`);
    process.exit(1);
  }
  console.log("\nDriver 11 OK");
})();
