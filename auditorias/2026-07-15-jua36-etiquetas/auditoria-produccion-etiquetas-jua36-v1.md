# Acta para dictamen — Etiquetas de producto (JUA-36) · v1

Fecha: 2026-07-15
Commit candidato: `8b153b8` (sobre prod actual `8032984`)
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Veredicto: **PENDIENTE DE DICTAMEN (GO/NO-GO)**

--------------------------------------------------------------------

## Alcance (JUA-36, proyecto "Resto del PRD")

Clasificar clientes por producto comprado o de interés con un catálogo de etiquetas **configurable
por negocio** (no lista fija). Tres criterios de aceptación: asignar una o varias desde la ficha ·
filtrar la lista por etiqueta · Marta crea y gestiona las etiquetas.

--------------------------------------------------------------------

## Cambios (10 archivos, +757 −12)

**Backend**

- **`convex/schema.ts`** — tabla nueva `etiquetas` (negocioId, nombre; índice `por_negocio`) y campo
  opcional `clientes.etiquetaIds` (array de ids). Cambio aditivo.
- **`convex/etiquetas.ts`** (nuevo) —
  · `listar` (ambos roles): etiquetas del negocio con su **nº de clientes** (excluye papelera) — el
    caso de uso de Marta "cuántos tengo por segmento".
  · `crear` / `renombrar` / `eliminar` (**solo admin**). `eliminar` quita la etiqueta de todos los
    clientes que la tengan (sin referencias huérfanas). Validaciones con `ConvexError` (lección
    JUA-120): nombre obligatorio, ≤30 caracteres, único por negocio sin distinguir mayúsculas.
- **`convex/clientes.ts`** — `listar` expone `etiquetaIds` (para el filtro); `detalle` expone
  `etiquetas` resueltas a nombre (ordenadas); mutación nueva `cambiarEtiquetas` (**ambos roles**,
  como la prioridad JUA-46): reemplaza el conjunto, deduplica, valida que cada etiqueta sea del
  negocio, marca `actualizadoEn` y NO cuenta como interacción.

**Frontend**

- **Ficha** (`selector-etiquetas.tsx` + fila en `tarjeta-perfil.tsx`): fila "Etiquetas de producto"
  con chips dorados y botón Añadir/Editar → hoja de **multiselección** con el catálogo; el admin
  además crea etiquetas al vuelo (input + botón, autoselecciona) y tiene enlace a la gestión.
- **Lista** (`pantalla-clientes.tsx`): chips dinámicos por etiqueta (icono Tag + nombre + nº de
  clientes) a continuación de los filtros de estado/prioridad (JUA-47). Selección única y
  **combinable con el buscador**, como los chips existentes.
- **Gestión** (`/etiquetas`, nuevo, **solo admin** con guard JUA-30 + acceso en Perfil → accesos
  admin): crear (input superior), renombrar (hoja con input) y eliminar (HojaConfirmar en tono
  danger que avisa "se quitará de N clientes"). Estado vacío con guía. Sin diseño en el handoff:
  sigue los patrones de Gestión de usuarios.

--------------------------------------------------------------------

## Decisiones de alcance (para tu revisión)

- **Asignar es de ambos roles; el catálogo es solo del admin** — la issue pide que las etiquetas
  las configure Marta; Carlos asigna/quita pero no crea ni gestiona (mismo reparto que usuarios).
- **Selección única en el filtro de la lista** (no multi-filtro), consistente con los chips de
  estado/prioridad existentes.
- **Sin catálogo semilla**: el negocio arranca sin etiquetas (la issue exige que sean suyas, no una
  lista fija). La hoja y la pantalla guían a crear la primera.
- **La tarjeta de la lista no muestra chips de etiqueta** (solo filtra) — evita saturar la tarjeta;
  ampliable si lo pides.
- **`src/lib/enums.ts` no cambia**: las etiquetas son datos por negocio, no un catálogo fijo del
  dominio.

--------------------------------------------------------------------

## Verificación ejecutada (0 errores)

```txt
npx tsc --noEmit       OK
npx eslint .           OK
npm run build          OK (ruta /etiquetas generada)
npx convex dev --once  OK (schema aditivo aceptado)
```

**Driver Playwright E2E (dev, 390×844): 16/16 PASS** — `tmp/drivers-jua36/driver-11-etiquetas.js`

- **A (gestión, admin):** acceso visible en Perfil → `/etiquetas` · crear "Formación" y
  "Consultoría" · duplicado "formación" rechazado con motivo visible ("Ya existe una etiqueta con
  ese nombre") · renombrar a "Consultoría Premium".
- **B (ficha, admin):** asignar ambas a Ana García → chips visibles en la tarjeta de perfil.
- **C (lista):** chips con conteo visibles · filtrar por "Formación" deja exactamente 1 cliente
  (Ana) · combinable con el buscador (texto sin match → "No encontramos…").
- **D (operativo):** Carlos NO ve el campo de crear · sí puede quitar una etiqueta y guardar ·
  `/etiquetas` le redirige a `/inicio` (guard JUA-30).
- **E (eliminar, admin):** la confirmación avisa "se quitará de 1 cliente" · desaparece del
  catálogo y de la ficha de Ana.

**Capturas:** `tmp/capturas-jua36/` — gestión con error de duplicado, ficha con chips, lista
filtrada por etiqueta.

Residuo QA en dev: etiqueta "Consultoría Premium" (0 clientes) en el catálogo del negocio demo.

--------------------------------------------------------------------

## Si el dictamen es GO

Con tu OK explícito: `npx convex deploy` (schema aditivo + funciones nuevas; las funciones deben ir
ANTES que el frontend porque la UI nueva las llama) → `git push` → Railway → verificación en vivo
(crear/asignar/filtrar/eliminar en el demo de prod) → JUA-36 Done en Linear + comentario → archivar
acta → actualizar `tmp/estado-produccion.md`.
