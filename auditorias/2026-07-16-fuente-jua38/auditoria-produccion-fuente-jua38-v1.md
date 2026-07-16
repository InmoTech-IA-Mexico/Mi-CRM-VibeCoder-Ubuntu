# Acta para dictamen — Fuente de contacto (JUA-38) · v1

Fecha: 2026-07-16
Commit candidato: `2a13acf` (sobre prod actual `5a95052`)
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Veredicto: **PENDIENTE DE DICTAMEN (GO/NO-GO)**

--------------------------------------------------------------------

## Alcance (JUA-38)

Campo **"Fuente de contacto"**: el origen específico de cómo llegó el cliente, un nivel más granular
que el **canal** (medio genérico: web/redes/email/WhatsApp) que ya existe en el MVP. Implementado como
**categoría predefinida + detalle libre opcional**, que es la opción que el PRD marca como preferible
(permite filtrar y, a futuro, reportar por fuente).

- **Categorías:** referido · campaña · evento · visita · otro.
- **Detalle:** texto libre corto y opcional (ej. "Referido por Ana García", "Campaña Black Friday 2026").

Criterios de aceptación (JUA-38): campo **opcional en la ficha** ✔ · **filtrable en la lista** ✔ ·
**NO aparece en el alta rápida** (no rompe el flujo mínimo) ✔.

--------------------------------------------------------------------

## Implementación

**Datos (`convex/schema.ts`, `src/lib/enums.ts` — mantenidos en sync):**
- `clientes.fuenteTipo` (unión `referido|campana|evento|visita|otro`, opcional) + `clientes.fuenteDetalle`
  (string, opcional). Campos **opcionales** → compatible hacia atrás, sin migración (los clientes
  existentes quedan sin fuente).
- Catálogo `FUENTES_CONTACTO` + `LABELS.fuenteContacto` en `enums.ts`.

**Backend (`convex/clientes.ts`):**
- `actualizar`: nuevos args `fuenteTipo`/`fuenteDetalle`. Reglas en servidor: el **detalle solo se
  guarda si hay tipo** (sin categoría no hay detalle huérfano) y se **acota a 120 caracteres**.
- `detalle`: devuelve `fuenteTipo`/`fuenteDetalle` para la ficha.
- `listar`: devuelve `fuenteTipo` para el filtro de la lista.

**Sin nueva superficie de autorización (lo relevante de seguridad):** la fuente se edita a través de
la mutación `clientes.actualizar` **ya existente**, que ya está protegida por **cartera** (JUA-43,
`verificarCartera`) y por **solo-escritura** (JUA-42, `resolverSesionEscritura` rechaza al observador).
Las lecturas (`detalle`/`listar`) ya filtran por cartera. No se añadió ninguna función pública nueva.

**UI:**
- **Ficha** (`tarjeta-perfil.tsx`): fila "Fuente de contacto" tras el canal — muestra el tipo (badge) y
  el detalle, o "Sin definir".
- **Edición** (`pantalla-editar-cliente.tsx`): selector de las 5 categorías (toggle) + campo de detalle
  con `placeholder` contextual (aparece solo al elegir tipo; `maxLength` 120).
- **Lista** (`pantalla-clientes.tsx`): chips de filtro por fuente **dinámicos** — solo las fuentes
  presentes entre los clientes visibles, cada una con su nº (mismo patrón que las etiquetas JUA-36).
  El filtro respeta la cartera (opera sobre la lista ya filtrada por `listar`).
- **Alta rápida** (`/clientes/nuevo`): **sin cambios** — la fuente no entra en el formulario mínimo.

--------------------------------------------------------------------

## Verificación (0 errores)

```txt
npx tsc --noEmit   OK      npm run build   OK (25 rutas)
npx eslint         OK      npx convex dev --once  OK
```

**Driver UI E2E — 11/11 PASS + 0 errores de navegador** (390×844, credenciales por env) —
`tmp/drivers-jua38/driver-25-fuente.js` (reporte `reporte-fuente-dev.txt`):
1. Edición: la sección "Fuente de contacto" existe; al elegir tipo aparece el detalle.
2. Ficha: muestra tipo **Campaña** + detalle **Black Friday 2026**.
3. Lista: aparece el chip **Campaña** y al filtrar deja solo el cliente (n=1).
4. Alta rápida: **NO** incluye el campo fuente.
5. Limpieza: al deseleccionar el tipo desaparece el detalle y la ficha vuelve a "Sin definir".

Capturas: `tmp/drivers-jua38/d25-*.png` (edición · ficha · filtro).

--------------------------------------------------------------------

## Decisiones de alcance (para tu revisión)

- **Categoría + detalle** (no texto libre puro): permite filtrar/reportar por fuente, como pide el PRD.
- **Filtro por categoría** (no por texto del detalle): los chips filtran por tipo; el detalle es
  informativo (evita un buscador extra). El buscador global de la lista no indexa la fuente.
- **Detalle sin tipo = no se guarda:** regla de servidor para no dejar detalle huérfano; la UI ya lo
  impide, pero se valida también en `actualizar` (defensa por si se llama por API).
- **Chips dinámicos** (solo fuentes presentes): evita saturar la fila de filtros con 5 chips fijos.
- **Edición solo desde "Editar cliente"** (igual que el canal): la ficha es de lectura para este campo.

## Si el dictamen es GO

`npx convex deploy` (esquema con 2 campos **opcionales** nuevos + funciones) → `git push` → Railway →
verificación en vivo en prod (editar fuente de un cliente QA, verla en ficha, filtrar en lista, y
confirmar ausencia en alta rápida) → JUA-38 Done + comentario → archivar evidencia a
`auditorias/2026-07-16-fuente-jua38/`.
