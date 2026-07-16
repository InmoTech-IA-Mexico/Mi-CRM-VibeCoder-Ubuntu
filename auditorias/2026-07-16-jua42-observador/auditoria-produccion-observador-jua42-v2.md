# Acta — Rol Observador / solo lectura (JUA-42) · v2 (remediación del NO-GO v1)

Fecha: 2026-07-16
Commits candidatos: `e363250` (base) + `e0933ad` (remedia B-1 / B-2 / OBS-1)
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Referencia: dictamen v1 = **NO-GO** (B-1 mutación pública escribible por el observador; B-2 alcance
de pantallas ambiguo).
Veredicto: **PENDIENTE DE DICTAMEN**

--------------------------------------------------------------------

## B-1 (BLOQUEANTE) — `sincronizarInactividad` escribible por el observador → RESUELTO (`e0933ad`)

`clientes.sincronizarInactividad` pasó de `resolverSesion` a **`resolverSesionEscritura`**: para el
observador devuelve `null` → `return { cambiados: 0 }` **sin ejecutar `transicionarClientes`** (cero
`ctx.db.patch`). La autorización se impone en servidor, no en que la UI omita la llamada. El cron
diario `transicionar-inactivos` (ya `internalMutation`) mantiene la transición para todos.

**Verificado (driver 21, sesión REAL de observador, dev):**
- Invocación directa → `cambiados = 0`.
- **Snapshot de `[_id, estado]` de todos los clientes idéntico antes y después** → cero escrituras.
- Admin/operativo siguen sincronizando con normalidad (no son observador).

Con esto, las **15 mutaciones que escriben datos del negocio** rechazan al observador (14 vía
`resolverSesionEscritura`/`seguimientoGestionable` + esta). El auditor tenía razón en el conteo: eran
15, no 14.

## B-2 — Alcance de pantallas de consulta → DEFINIDO Y DOCUMENTADO

Interpretación adoptada (opción 1 del dictamen), fiel al PRD de JUA-42, que enumera lo que el
observador ve —"lista de clientes, fichas, historial, oportunidades, recordatorios"— y lo que no
—"Gestión de usuarios ni Papelera"—, sin mencionar Ventas/Resumen/Supervisión:

**El observador consulta el NÚCLEO CRM en modo lectura:**
- ✔ **Inicio** (agenda + panel de inactividad), **Clientes** (lista + buscador + filtros), **ficha
  de cliente** (perfil, historial, oportunidades, recordatorios — todo lectura) y **Estado global
  de clientes** (`/estado`, ya de ambos roles).
- ✘ **Fuera (admin-only, como para el operativo):** paneles administrativos/analíticos Ventas,
  Resumen y Supervisión; y la administración: Usuarios, Papelera, Etiquetas, Exportar datos.

No requiere cambio de código (esos guards admin ya excluyen al observador). Se corrige el copy del
acta v1 ("consulta todas las pantallas" → "consulta el núcleo CRM en lectura").

**Verificado (driver 20):** `/estado` es accesible al observador en lectura; las 7 rutas de
alta/edición redirigen a `/inicio`.

## OBS-1 — El observador no debe recibir tareas que no puede completar → RESUELTO (`e0933ad`)

`usuarios.equipo` excluye a los observadores (no aparecen como responsable/empleado en los
selectores) y `seguimientos.crear` valida que el responsable y el empleado destino no sean
observador ("Responsable no válido" / "Empleado no válido"). Así ningún admin puede asignarle un
seguimiento.

## Observaciones documentales del dictamen v1

- **OBS-2 (403):** el rechazo es un error de servidor de Convex ("No autorizado"), no un status HTTP
  403 literal; el acta usa "rechazo de servidor por no autorización".
- **OBS-3 (comentarios de dos roles):** se actualizarán gradualmente; no afectan el comportamiento.
- **OBS-4 (usuario QA):** `observador.qa@test.mx` queda en dev para reproducir; en prod se creará y
  **revocará** un observador QA al cerrar el ciclo.

--------------------------------------------------------------------

## Verificación (0 errores)

```txt
npx tsc --noEmit   OK      npm run build          OK
npx eslint .       OK      npx convex dev --once  OK
```

**Driver 21 — negativas de servidor (dev, sesión real de observador): 18/18 PASS** —
`tmp/drivers-jua42/reporte-obs-servidor-dev.txt`. Reporte durable sanitizado que el auditor pedía:
2 lecturas positivas + **las 15 escrituras de datos del negocio rechazadas** (incluida
`sincronizarInactividad` con snapshot sin cambios). Las admin-only ya se probaron en v1.

**Driver 20 — UI (dev, credenciales por env, vigila pageerror/console.error): 23/23 PASS** —
`tmp/drivers-jua42/reporte-observador-ui-dev.txt`. 3 roles en invitar · ficha del observador sin
ningún botón de escritura · `/estado` accesible · **las 7 rutas** de alta/edición redirigen (no 3).
Ruido de navegador (`beforeunload` de los formularios al redirigir el guard sin gesto) documentado y
excluido; corrida por lo demás limpia.

Cobertura de los criterios para levantar el NO-GO: 1 ✔ (bloqueo en servidor) · 2 ✔ (snapshot sin
cambios) · 3 ✔ (15 negativas con reporte durable) · 4 ✔ (alcance definido y probado) · 5 ✔ (7 guards)
· 6 ✔ (tsc/eslint/build/convex en 0) · 7 ✔ (OBS-1 resuelto).

--------------------------------------------------------------------

## Si el dictamen es GO

`npx convex deploy` (schema aditivo — literal nuevo en `rol` — + funciones, ANTES del frontend) →
`git push` → Railway → verificación en vivo (invitar/activar un observador QA en prod, negativas de
servidor + navegación de consulta, y **revocar** el QA al terminar) → JUA-42 Done + comentario →
evidencia a `auditorias/` → estado de producción.
