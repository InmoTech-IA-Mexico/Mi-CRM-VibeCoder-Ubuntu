# Acta para dictamen — Cartera por vendedor (JUA-43) · v1

Fecha: 2026-07-16
Commit candidato: `e75d2bd` (sobre prod actual `b1a2c41`; app funcional previa `e0933ad`)
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Veredicto: **PENDIENTE DE DICTAMEN (GO/NO-GO)**

--------------------------------------------------------------------

## Alcance (JUA-43)

Asignación de clientes por vendedor: cada **operativo** ve y gestiona solo los clientes de los que
es **responsable**; **Marta (admin)** ve todos (con toggle "Mis clientes / Todos"); un cliente sin
responsable queda en un pool "sin asignar" visible solo para el admin. El campo `responsableId` ya
existía en el esquema del MVP; esto añade el **filtrado por cartera con enforcement en servidor**.

Decisión de alcance: el **observador** (lectura global del negocio, JUA-42) ve todos los clientes —
no tiene cartera, es un rol de supervisión de solo lectura.

--------------------------------------------------------------------

## Enforcement en servidor (la parte crítica de seguridad)

Helpers en `convex/clientes.ts`:
- `esDeCartera(cliente, sesion)` → el operativo solo su cartera; admin/observador todos.
- `verificarCartera(sesion, cliente)` → lanza "No encontrado" si un operativo toca un cliente ajeno
  (no revela existencia). Exportado y reutilizado por los otros módulos.

**Lecturas filtradas por cartera (operativo):**
- `clientes.listar` — arg `soloMios` (toggle del admin); operativo siempre su cartera.
- `clientes.detalle` — ficha ajena para operativo → `null` (no accesible ni por URL/API).
- `inicio.agendaDelDia` — el operativo solo ve la agenda de sus clientes.
- `inicio.panelInactividad` — el operativo solo sus clientes inactivos.

**Escrituras (defensa en profundidad — un operativo no escribe clientes ajenos ni por API):**
`verificarCartera` aplicado a `clientes.cambiarEstado / cambiarPrioridad / cambiarEtiquetas /
actualizar` y a `notas.crear`, `oportunidades.crear`, `ventas.crear`, `seguimientos.crear` (destino
cliente).

**Asignación:** `clientes.asignarResponsable` (mutación nueva, **solo admin**): asigna / reasigna /
desasigna (`responsableId = null` → pool). El nuevo responsable debe ser del negocio, activo y **no
observador**. `clientes.crear` ya asignaba el responsable al creador (sin cambio). `clientes.detalle`
expone el responsable (nombre) para la ficha.

## UI

- **Ficha** (tarjeta de perfil): fila "Responsable" con selector (solo admin) que abre una hoja con
  el equipo + "Sin asignar" (con carga de cada vendedor); para operativo/observador muestra el valor
  en solo lectura.
- **Lista** (solo admin): toggle "Todos / Mis clientes" que filtra por su cartera.

--------------------------------------------------------------------

## Verificación (0 errores)

```txt
npx tsc --noEmit   OK      npm run build          OK
npx eslint .       OK      npx convex dev --once  OK
```

**Aislamiento por CLI (dev, con un 2º operativo QA "vendedor2"; Ana asignada a vendedor2):**
- **Lectura:** Marta ve 16 (todos), con `soloMios` 7 (los suyos); Carlos 8 (su cartera, **sin Ana**);
  vendedor2 1 (**solo Ana**). `detalle` de Ana → Carlos `null`, vendedor2/Marta la ven.
- **Escritura de Carlos sobre Ana (ajena) → "No encontrado"** en las 6: cambiarEstado,
  cambiarPrioridad, actualizar, notas.crear, oportunidades.crear, ventas.crear. vendedor2 **sí**
  gestiona a Ana (es suya).
- **Asignación:** Carlos intenta `asignarResponsable` → "No autorizado"; Marta desasigna (pool) →
  vendedor2 deja de ver a Ana.

**Driver UI E2E (dev, 390×844, credenciales por env): 12/12 PASS + sin errores de navegador** —
`tmp/drivers-jua43/driver-22-cartera.js`:
- Admin: toggle Todos (16) → Mis clientes (7); ficha con selector, responsable = "Vendedor Dos" →
  **reasigna a Carlos** en la ficha.
- vendedor2: no ve el toggle (solo admin); ya no ve a Ana; su ficha por URL → "no encontrado".
- Carlos: tras la reasignación ve a Ana; abre su ficha; **no** ve el selector de responsable; ve a
  Carlos como responsable en lectura.

Capturas: `tmp/capturas-jua43/` (ficha con Responsable=Carlos · toggle "Mis clientes"=7).
Usuarios QA en dev: `vendedor2.qa@test.mx` (operativo). Ana quedó asignada a Carlos.

Criterios de aceptación: **el vendedor ve solo sus clientes asignados** ✔ · **Marta ve todos** ✔
(+ toggle) · **la asignación se cambia desde la ficha** ✔.

--------------------------------------------------------------------

## Decisiones de alcance (para tu revisión)

- **Escritura además de lectura:** el PRD centra el criterio en "ver solo su cartera", pero para
  coherencia de seguridad (evitar que un operativo edite por API un cliente que no ve) apliqué el
  check de cartera también a las mutaciones. Un operativo no lee **ni** escribe clientes ajenos.
- **Observador ve todos** (no tiene cartera) — coherente con su rol de lectura global (JUA-42).
- **La agenda de seguimientos a EMPLEADO** (JUA-119) sigue por responsable del seguimiento; la
  cartera filtra los seguimientos de CLIENTE por el responsable del cliente.
- **`crear` asigna el responsable al creador:** un operativo que da de alta un cliente lo tiene en
  su cartera automáticamente; Marta puede reasignarlo.

## Si el dictamen es GO

`npx convex deploy` (funciones + arg nuevo; schema sin cambios — `responsableId` ya existía) →
`git push` → Railway → verificación en vivo (crear 2º operativo QA en prod, aislamiento
lectura/escritura + toggle + asignación, y revocar el QA al terminar) → JUA-43 Done + comentario →
evidencia a `auditorias/` → estado de producción.
