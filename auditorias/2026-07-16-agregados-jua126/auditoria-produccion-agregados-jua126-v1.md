# Acta para dictamen — Visibilidad de agregados por cartera (JUA-126) · v1

Fecha: 2026-07-16
Commit candidato: `2e92576` (sobre prod actual `7dfa2aa`)
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Veredicto: **PENDIENTE DE DICTAMEN (GO/NO-GO)**

--------------------------------------------------------------------

## Alcance (JUA-126 — origen: OBS-2 del dictamen de JUA-43)

Tras cerrar el aislamiento por cartera (JUA-43), dos queries seguían devolviendo **métricas
agregadas de todo el negocio a un operativo** (no fichas individuales, pero sí volúmenes de otras
carteras):

- `etiquetas.listar` — nº de clientes por etiqueta de **todo el negocio**.
- `usuarios.equipo` — **carga de clientes de cada miembro** del equipo.

Este cambio define y aplica la **política de visibilidad** para el rol operativo.

## Política aplicada

**`convex/etiquetas.ts` › `listar`:** el conteo de clientes por etiqueta se limita a la **cartera**
del solicitante mediante `esDeCartera` (reutilizado de JUA-43). El **operativo** cuenta solo sus
clientes; **admin y observador** (lectura global del negocio) cuentan el negocio completo. Esto además
**corrige una inconsistencia**: antes el chip de filtro mostraba un total global pero al filtrar solo
aparecían los de la cartera; ahora el conteo coincide con lo que el operativo puede ver.

**`convex/usuarios.ts` › `equipo`:** la **carga por miembro** (`clientes`) es información de gestión y
solo se expone al **admin**. Al operativo se le devuelve la lista de miembros (nombres y roles, que
necesita para elegirse a sí mismo y ver responsables) con `clientes: null`. La UI que muestra la carga
—selector de responsable (JUA-43) y reasignación de seguimiento (JUA-119)— **ya es admin-only**, así
que el comportamiento visible del operativo no cambia; solo deja de recibir el dato por la red.

**Sin cambios de esquema, de UI ni de otras funciones.** Solo se ajusta qué devuelven estas dos
queries según el rol.

## Nota de alcance

- El **observador** mantiene la visión global (conteos del negocio completo): es su rol de supervisión
  de solo lectura (JUA-42), coherente con que ve todos los clientes.
- La pantalla `/etiquetas` (gestión del catálogo) es **admin-only**, por lo que el conteo global de
  Marta ahí no cambia.

--------------------------------------------------------------------

## Verificación (0 errores)

```txt
npx tsc --noEmit   OK      npm run build   OK (25 rutas)
npx eslint         OK      npx convex dev --once  OK
```

**Driver de servidor — 4/4 PASS** (dos operativos QA + cliente ajeno; reporte sanitizado sin tokens ni
contraseñas) — `tmp/drivers-jua126/driver-27-agregados-servidor.js`
(reporte `reporte-agregados-dev.txt`):

```txt
A: equipo del operativo → lista con nombres/roles pero SIN carga (clientes=null en todos)
A: equipo del admin → SÍ incluye la carga por miembro (numérica)
B: el operativo cuenta solo su cartera para la etiqueta (1 = 1)
B: el admin cuenta el negocio completo para la etiqueta (2 = 2)
```

(Se creó una etiqueta y dos clientes QA —uno de la cartera de Carlos, uno de otro vendedor— con la
misma etiqueta; se eliminaron al terminar.)

--------------------------------------------------------------------

## Decisiones (para tu revisión)

- **Conteo de etiqueta por cartera** para el operativo (no ocultarlo): mantiene el chip útil y lo hace
  **consistente** con el filtro; no revela volúmenes de otras carteras.
- **Carga de equipo solo admin** (no cartera): la carga es un dato por-miembro de gestión; no tiene
  sentido "por cartera". Se oculta al operativo (null) en lugar de fingir un 0.
- **Se conserva la lista de miembros** para el operativo (nombres/roles): no es sensible y la usa para
  identificarse y mostrar responsables; lo acotado por OBS-2 era la **carga**, no la existencia del equipo.

## Si el dictamen es GO

`npx convex deploy` (solo funciones; sin esquema) → **verificar contra prod que el cambio existe**
(functionSpec / llamada `--prod`, lección JUA-38) → `git push` → Railway → verificación en vivo
(equipo del operativo sin cargas; conteo de etiqueta por cartera) → JUA-126 Done + comentario →
archivar evidencia a `auditorias/2026-07-16-agregados-jua126/`.
