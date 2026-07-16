# Acta de auditoría — Cartera por vendedor (JUA-43) · v1

Fecha: 2026-07-16  
Commit auditado: `e75d2bd`  
Base: `b1a2c41` (`e0933ad` como última base funcional)  
Estado revisado: candidato local; no desplegado por esta auditoría  
Veredicto: **NO-GO — aislamiento de cartera incompleto en funciones públicas**

---

## Resultado

No procede desplegar `e75d2bd` todavía.

La lista y la ficha de clientes sí incorporan correctamente la restricción de cartera, y la nueva asignación de responsable es exclusivamente administrativa. Sin embargo, varias funciones públicas que operan sobre recursos ya existentes no validan que el cliente padre pertenezca a la cartera del operativo. Una sesión operativa puede, con identificadores obtenidos legítimamente antes de una reasignación, desde caché o desde otra ruta pública, leer datos de un cliente ajeno o modificar oportunidades, seguimientos y estados fuera de su cartera.

En Convex, las `query` y `mutation` públicas son invocables desde el cliente; por ello cada una debe aplicar su propia autorización de objeto, sin depender de que la UI o una lista deje de mostrarlo. [Documentación oficial de Convex](https://docs.convex.dev/understanding/best-practices#use-some-form-of-access-control-for-all-public-functions)

## Integridad y comprobaciones locales

- `e75d2bd` es hijo directo de `b1a2c41`; `origin/main` permanecía en `b1a2c41` durante la revisión.
- Delta: 9 archivos, `+281 −4`; `git diff --check b1a2c41..e75d2bd` sin incidencias.
- No se observaron cambios fuera del alcance declarado. El árbol estaba limpio antes de crear esta acta.
- `npx tsc --noEmit` y `npx eslint .` finalizaron correctamente.
- `npm run build` finalizó correctamente. El primer intento no pudo descargar fuentes de Google por la restricción de red del entorno; el reintento autorizado compiló y generó las 25 rutas.
- No se invocaron mutaciones, no se ejecutó `convex dev --once`, no se modificaron datos de dev o producción, ni se desplegó o publicó nada.

## Hallazgos bloqueantes

### B-1 — Cambio de etapa de oportunidad fuera de cartera

**Estado: ABIERTO.**

`oportunidades.cambiarEtapa` resuelve la oportunidad mediante `oportunidadEditable`, que valida negocio, cliente existente y papelera, pero no llama a `verificarCartera` sobre el cliente padre. La protección añadida en el candidato solo cubre `oportunidades.crear`.

Un operativo puede cambiar la etapa, los motivos de cierre y `actualizadoPor` de una oportunidad ajena. Además, la transición a/desde Ganada puede crear o cancelar un seguimiento post-venta de ese cliente.

**Corrección requerida:** hacer que el helper devuelva también el cliente y aplicar `verificarCartera(sesion, cliente)` antes de cualquier `patch`, o centralizar ese control en el helper para todas las mutaciones no administrativas de oportunidad.

### B-2 — Gestión de seguimientos existentes fuera de cartera

**Estado: ABIERTO.**

`seguimientos.reprogramar`, `seguimientos.cancelar` y `seguimientos.eliminar` comparten `seguimientoGestionable`. Este helper valida negocio y que el llamador sea responsable del seguimiento o admin, pero no valida la cartera cuando `destino === "cliente"`. `inicio.marcarSeguimientoRealizado` repite la misma autorización incompleta.

Así, si un seguimiento de cliente conserva como responsable a un operativo pero el cliente fue reasignado a otro vendedor, el responsable anterior puede seguir reprogramándolo, cancelándolo, borrándolo o marcarlo realizado mediante la API. La agenda ya lo oculta, pero ocultarlo no es control de acceso.

**Corrección requerida:** para todo seguimiento de destino `cliente`, cargar el cliente y aplicar `verificarCartera`; conservar la regla actual de responsable para seguimientos de destino `empleado`. Conviene reutilizar un único helper desde `seguimientos` e `inicio` para evitar que vuelvan a divergir.

### B-3 — Sincronización de inactividad modifica toda la cartera

**Estado: ABIERTO.**

`clientes.sincronizarInactividad` es una mutación pública y acepta a cualquier sesión de escritura. Tras el cambio JUA-42 ya excluye al observador, pero para un operativo consulta todos los clientes y seguimientos del negocio y llama a `transicionarClientes` sobre el conjunto completo. `PantallaInicio` la invoca automáticamente para cualquier rol con `usePuedeEditar`, incluido el operativo.

Por tanto, al abrir Inicio un vendedor puede cambiar a `inactivo` clientes de otros vendedores. Es una escritura automática, pero sigue siendo una escritura iniciada por una sesión sin autorización sobre esos clientes.

**Corrección requerida:** restringir esta mutación pública al admin y mantener el cron interno como mecanismo global, o limitar estrictamente el conjunto de clientes a la cartera de la sesión operativa antes de llamar a `transicionarClientes`.

### B-4 — Búsqueda de duplicados revela datos de cliente ajeno

**Estado: ABIERTO.**

`clientes.buscarDuplicado` continúa recorriendo todos los clientes activos del negocio. Ante coincidencia devuelve `_id`, nombre, teléfono y correo, sin pasar el resultado por `esDeCartera`.

Un operativo que conoce un teléfono o email puede confirmar y recuperar datos de un cliente asignado a otro vendedor, contradiciendo la regla de que solo ve su cartera.

**Corrección requerida:** filtrar por cartera antes de encontrar y devolver la coincidencia para sesiones operativas. Si el negocio exige detectar duplicados globales, debe definirse un flujo que no revele identidad ni datos del cliente ajeno y documentarse como excepción explícita.

### B-5 — Estado global expone métricas de todo el negocio al operativo

**Estado: ABIERTO.**

La ruta `/estado` sigue disponible para el operativo y `inicio.estadoGlobal` sigue calculando sobre todos los clientes, oportunidades y seguimientos activos del negocio. Muestra total, distribución por estado, oportunidades abiertas por etapa, pendientes, vencidos y clientes sin atender. Sus enlaces a `/clientes` terminan filtrándose correctamente, pero las cifras expuestas no.

La acta candidata no declara una excepción para que el operativo conozca métricas de la cartera ajena; por el contrario, fija que ve y gestiona solo sus clientes. En esas condiciones el agregado global es una divulgación fuera de alcance.

**Corrección requerida:** filtrar todas las colecciones derivadas por los IDs de la cartera del operativo, o limitar `/estado` y `estadoGlobal` al admin. Si se pretende conservar un tablero global para operativos, debe ser una decisión de producto y seguridad explícita, no un efecto residual de JUA-35.

## Elementos correctamente implementados

- `clientes.listar` fuerza la cartera del operativo aunque este manipule `soloMios`; el admin puede alternar entre todos y su cartera.
- `clientes.detalle` devuelve `null` fuera de cartera para operativo, sin revelar la existencia del cliente.
- `clientes.cambiarEstado`, `cambiarPrioridad`, `cambiarEtiquetas`, `actualizar`, y las altas de notas, oportunidades, ventas y seguimientos de cliente sí aplican `verificarCartera`.
- `agendaDelDia` y `panelInactividad` filtran la visualización del operativo por responsable del cliente.
- `asignarResponsable` exige admin y valida negocio, estado activo y exclusión del observador. La interfaz mantiene el selector solo para admin y muestra lectura para operativo/observador.
- El cliente sin responsable no aparece en la lista del operativo; queda accesible al admin.

## Evidencia revisada

El driver preservado `tmp/drivers-jua43/driver-22-cartera.js` pasa comprobación sintáctica de Node. El reporte guardado registra **13 PASS / 0 FAIL**: 12 aserciones funcionales y la comprobación global de ausencia de `pageerror`/`console.error` inesperados. Las capturas son coherentes con el flujo visual descrito.

Ese recorrido demuestra correctamente:

- Toggle administrativo Todos/Mis clientes.
- Reasignación visible desde ficha.
- Lista y ficha ocultas para el vendedor que dejó de ser responsable.
- Acceso del nuevo responsable y ausencia de selector para operativo.

No cubre B-1 a B-5: no invoca `cambiarEtapa`, gestión o cierre de seguimientos existentes, `sincronizarInactividad`, `buscarDuplicado` ni `/estado`. Por ello no puede acreditar el enforcement completo que afirma el acta candidata.

## Observaciones no bloqueantes

### OBS-1 — Conteos globales en superficies auxiliares

`etiquetas.listar` continúa devolviendo a cualquier operativo los conteos de etiqueta de toda la empresa, y `usuarios.equipo` devuelve la carga de clientes de cada integrante. No exponen fichas individuales, pero son agregados de otras carteras. Definir si estos datos son necesarios para el operativo y, si no lo son, devolver conteos de su cartera o suprimirlos en sus vistas.

### OBS-2 — Robustez del driver

El driver usa pausas fijas de 1.5–2 segundos en los puntos principales y no restituye la asignación de Ana ni elimina el usuario QA. La evidencia conserva el estado final declarado, pero futuras corridas deberían usar esperas por condición y una restauración en `finally`, con reporte explícito de limpieza.

## Criterios para levantar el NO-GO

1. Corregir B-1 a B-5 en servidor; no basta ocultar controles o rutas en la UI.
2. Ejecutar negativas directas, con dos operativos y cliente ajeno, para:
   - `oportunidades.cambiarEtapa`;
   - `seguimientos.reprogramar`, `cancelar`, `eliminar` e `inicio.marcarSeguimientoRealizado` sobre un seguimiento de cliente ajeno cuyo responsable sea el primer operativo;
   - `clientes.sincronizarInactividad`, verificando snapshot inmutable fuera de la cartera;
   - `clientes.buscarDuplicado`, verificando que no devuelve datos de un cliente ajeno;
   - `inicio.estadoGlobal`, verificando totales y agregados limitados a cartera, o rechazo por rol si se vuelve administrativo.
3. Repetir el recorrido UI de asignación/lista/ficha y los chequeos `tsc`, `eslint`, build y Convex dev.
4. Preservar un reporte sanitizado de esas negativas y restaurar o revocar los datos QA usados.

## Constancia de auditoría

Esta auditoría fue de solo lectura sobre Git, código, driver, reporte, capturas y documentación oficial. No se modificó código de aplicación, configuración productiva, datos, despliegues, repositorio remoto ni Linear.
