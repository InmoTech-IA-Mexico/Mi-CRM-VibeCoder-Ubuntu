# JUA-42 — Rol Observador / solo lectura (2026-07-16)

Ciclo: v1 **NO-GO** (B-1 `sincronizarInactividad` escribible por el observador; B-2 alcance de
pantallas ambiguo) → v2 **GO con obs. no bloqueantes**. En producción desde **`e0933ad`** (Convex
`glad-bird-297` + Railway SUCCESS). Verificado en vivo (8/8 checks del dictamen).

## Qué hace

Tercer rol **Observador**: consulta el núcleo CRM en modo lectura (Inicio, Clientes, ficha, Estado
global) sin poder crear, editar ni eliminar. Marta lo asigna desde Gestión de usuarios.

## Seguridad (servidor = fuente de verdad)

`resolverSesionEscritura` (en `convex/auth.ts`) rechaza al observador; aplicado a las **15**
mutaciones que escriben datos del negocio (incluida `sincronizarInactividad`, la que el auditor
detectó abierta en v1). Las admin-only ya lo bloqueaban. El observador tampoco es asignable como
responsable/destino de seguimientos.

## Contenido

- `auditoria-produccion-observador-jua42-v1.md` / `-v2.md` — actas.
- `drivers/driver-21-observador-servidor.js` — negativas de servidor (sesión real de observador):
  las 15 escrituras rechazadas + snapshot sin cambios de B-1 + OBS-4 (admin sincroniza) + OBS-7
  (asignación al observador rechazada). Credenciales/ids por env; try/finally; reporte durable.
- `drivers/driver-20-observador.js` — UI E2E: 3 roles en invitar, ficha sin botones, /estado
  accesible, las 7 rutas de alta/edición redirigen. Vigila pageerror/console.error.
- `drivers/reporte-*-prod.txt` — corridas contra producción (servidor 21/21, UI 23/23).
- `capturas/` — ficha del observador en lectura · selector de 3 roles.

Usuario QA de prod `obs-qa-prod@demo.mx` **revocado** al cerrar (sesión ya inválida). Sin secretos
vigentes en la evidencia (escaneado).
