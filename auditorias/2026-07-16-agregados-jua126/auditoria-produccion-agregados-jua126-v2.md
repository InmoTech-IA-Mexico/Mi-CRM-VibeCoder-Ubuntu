# Acta para dictamen — Visibilidad de agregados por cartera (JUA-126) · v2 (remediación NO-GO)

Fecha: 2026-07-16
Commit candidato: `1bbeb9c` (remediación) sobre `2e92576` (v1); prod actual `7dfa2aa`
Estado: remediado y verificado en local + dev de Convex. **NO desplegado.**
Veredicto: **PENDIENTE DE DICTAMEN (GO/NO-GO)**

--------------------------------------------------------------------

## Origen: dictamen v1 = NO-GO (B-1)

La política de servidor estaba bien, pero el cambio de `usuarios.equipo.usuarios[].clientes` a `null`
para no-admin **degradaba una ruta del operativo**: en `/seguimientos/nuevo`, al crear una **tarea
personal** (destino Empleado), la tarjeta del propio operativo mostraba literalmente
`Operativo · null clientes`. `tsc`/`build` no lo detectaban porque interpolar `null` en una plantilla
es válido en JS. Mi acta v1 afirmó "sin cambios de UI", lo cual era incorrecto.

## Remediación (`1bbeb9c`)

Se adaptaron **los dos** consumidores de `usuarios.equipo` que interpolan la carga, para **omitir el
conteo cuando `clientes == null`** (mostrar solo el rol) y **conservar la cifra numérica para el
admin**:

- `src/app/(app)/seguimientos/nuevo/…/pantalla-programar-seguimiento.tsx` › `subtituloMiembro`
  (usado en la tarjeta de empleado del operativo y en la hoja de selección del admin).
- `src/app/(app)/clientes/[id]/…/selector-responsable.tsx` (subtítulo del selector; es admin-only, se
  guarda por consistencia y defensa).

No se tocó la política de servidor ni el esquema. Búsqueda exhaustiva: `grep` de `.clientes` sobre
consumidores de `equipo` → solo esos dos; ambos corregidos.

--------------------------------------------------------------------

## Verificación (0 errores)

```txt
npx tsc --noEmit   OK      npm run build   OK (25 rutas)
npx eslint         OK      npx convex dev --once  OK (v1)
```

**Driver UI — 5/5 PASS + 0 errores de navegador** (390×844, credenciales por env) —
`tmp/drivers-jua126/driver-28-agregados-ui.js` (reporte `reporte-agregados-ui-dev.txt`), que cubre el
criterio #2 del dictamen:
```txt
A: operativo (tarea personal) — la tarjeta de empleado muestra el rol (Operativo)
A: operativo — la tarjeta NO muestra 'null' (B-1 corregido)
B: admin — la hoja de empleados muestra la carga (N clientes)
B: admin — sin 'null' en las cargas
sin errores de navegador
```
Capturas: `tmp/drivers-jua126/d28-operativo-empleado.png` · `d28-admin-hoja.png`.

**Driver de servidor — 5/5 PASS** (ahora con la aserción del observador, OBS-2; toda la preparación
dentro de `try/finally`, OBS-1) — `tmp/drivers-jua126/driver-27-agregados-servidor.js`
(reporte `reporte-agregados-dev.txt`):
```txt
A: equipo del operativo → SIN carga (clientes=null en todos)
A: equipo del observador → también SIN carga (clientes=null) [OBS-2]
A: equipo del admin → SÍ incluye la carga por miembro (numérica)
B: el operativo cuenta solo su cartera para la etiqueta (1 = 1)
B: el admin cuenta el negocio completo para la etiqueta (2 = 2)
```
(Se crearon y **eliminaron** un observador QA, una etiqueta y dos clientes QA.)

## Observaciones del dictamen v1 — atendidas

- **B-1** (bloqueante) — corregido en los dos consumidores + prueba UI que lo cubre. ✔
- **OBS-1** (limpieza del driver ante fallos) — toda la preparación (incl. logins) va dentro del
  `try/finally`; la limpieza corre aunque falle. ✔
- **OBS-2** (cobertura de observador) — aserción explícita añadida: el observador también recibe
  `clientes: null`. ✔

## Si el dictamen es GO

`npx convex deploy` (solo funciones; sin esquema) → **verificar contra prod que el cambio existe**
(`function-spec --prod`, protocolo de despliegue post-incidente JUA-38) → `git push` → Railway →
verificación en vivo (operativo en tarea personal sin "null"; admin con cargas) → JUA-126 Done +
comentario → archivar evidencia a `auditorias/2026-07-16-agregados-jua126/`.
