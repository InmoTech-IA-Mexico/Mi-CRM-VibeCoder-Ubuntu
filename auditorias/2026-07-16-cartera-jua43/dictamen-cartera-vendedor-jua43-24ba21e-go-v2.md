# Acta de auditoría — Cartera por vendedor (JUA-43) · v2

Fecha: 2026-07-16  
Commits auditados: `e75d2bd` + `24ba21e`  
Base productiva: `b1a2c41`  
Estado revisado: candidato local; no desplegado por esta auditoría  
Referencia: dictamen v1 = **NO-GO** por B-1 a B-5  
Veredicto: **GO CON OBSERVACIONES NO BLOQUEANTES**

---

## Resultado

Se levanta el NO-GO de JUA-43. `24ba21e` remedia en servidor los cinco hallazgos bloqueantes del dictamen v1 y no introduce una regresión funcional o de autorización que impida el despliegue.

El control ya no depende de que una pantalla o una agenda oculte el recurso: las funciones públicas que reciben oportunidades, seguimientos, búsqueda de duplicados, sincronización y agregados validan o derivan el ámbito de la cartera. Esto es necesario porque las `query` y `mutation` públicas de Convex son accesibles desde el cliente y requieren control de acceso por función y objeto. [Documentación oficial de Convex](https://docs.convex.dev/understanding/best-practices#use-some-form-of-access-control-for-all-public-functions)

## Integridad y comprobaciones locales

- `24ba21e` es hijo directo de `e75d2bd`; `origin/main` permanecía en `b1a2c41` durante la auditoría.
- Delta de remediación: 4 archivos, `+55 −10`, exclusivamente en `convex/clientes.ts`, `inicio.ts`, `oportunidades.ts` y `seguimientos.ts`.
- `git diff --check e75d2bd..24ba21e` no reportó errores; el árbol estaba limpio antes de crear esta acta.
- `npx tsc --noEmit`, `npx eslint .` y `npm run build` finalizaron correctamente. El primer build local no pudo descargar fuentes de Google por la restricción de red; el reintento autorizado compiló correctamente las 25 rutas.
- No se ejecutaron drivers ni mutaciones de Convex, no se alteraron datos, no hubo despliegue, `git push` ni acciones en Linear desde esta auditoría.

## Revisión de bloqueantes v1

### B-1 — Oportunidades existentes

**Estado: RESUELTO.**

`oportunidadEditable` ahora recibe la sesión, carga el cliente padre y llama a `verificarCartera` antes de devolver la oportunidad. `cambiarEtapa` la utiliza antes de cualquier cambio de etapa, motivo o post-venta. `eliminar` también usa el helper, aunque ya era exclusivamente administrativa.

El driver de negativas registra el rechazo `No encontrado` de `cambiarEtapa` sobre oportunidad ajena y confirma que la etapa permanece en `nueva`.

### B-2 — Seguimientos de cliente existentes

**Estado: RESUELTO.**

`seguimientoGestionable` exige ahora la cartera del cliente cuando el destino es `cliente`, además de conservar la regla de responsable o admin. Por esa vía quedan cubiertos `reprogramar`, `cancelar` y `eliminar`. `inicio.marcarSeguimientoRealizado` aplica la misma validación antes de modificar el seguimiento.

La migración añadida en `clientes.asignarResponsable` mueve al nuevo dueño los seguimientos pendientes de cliente cuyo responsable era el dueño anterior. No modifica tareas de empleado ni delegaciones explícitas del admin a un tercero. La prueba cubre tanto el rechazo del dueño anterior como la gestión correcta por el nuevo dueño y el caso de defensa en profundidad de una delegación cruzada.

### B-3 — Sincronización de inactividad

**Estado: RESUELTO.**

La mutación pública conserva acceso de escritura para admin y operativo, pero filtra el conjunto que entrega a `transicionarClientes` mediante `esDeCartera`. El cron interno continúa siendo la ruta global del negocio. Por tanto, abrir Inicio como operativo ya no puede modificar estados de otra cartera.

El reporte preservado compara el snapshot de la cartera del segundo vendedor antes y después de la sincronización del primero y no observa cambios.

### B-4 — Búsqueda de duplicados

**Estado: RESUELTO.**

`buscarDuplicado` incorpora `esDeCartera` en el predicado previo a devolver el documento. Para un operativo, una coincidencia de otra cartera se comporta como ausencia y no expone ID, nombre, teléfono o email. El dueño sí recibe su propia coincidencia.

### B-5 — Estado global

**Estado: RESUELTO.**

`estadoGlobal` construye primero la colección de clientes activos aplicando `esDeCartera`. Sus IDs alimentan después todos los agregados: total y estados, oportunidades, seguimientos, vencidos y sin atender. Admin y observador conservan el tablero global conforme al alcance declarado.

La prueba dinámica comprueba que el total del operativo es menor que el del administrador en el fixture de dos carteras; la derivación completa de los demás agregados fue corroborada estáticamente.

## Evidencia revisada

- `tmp/drivers-jua43/driver-23-cartera-servidor.js` pasa la comprobación sintáctica de Node y el reporte sanitizado declara **13 PASS / 0 FAIL**. Incluye B-1, B-2 en sus cuatro operaciones, continuidad tras reasignación, B-3, B-4 y B-5.
- `tmp/drivers-jua43/driver-22-cartera.js` y su reporte muestran **13 PASS / 0 FAIL**: 12 aserciones visuales y el vigilante de `pageerror`/`console.error`.
- Las capturas de toggle y de responsable son consistentes con el recorrido descrito.

La auditoría no repitió esos drivers porque crean, reasignan y eliminan datos en Convex dev; su código y reportes fueron revisados sin ejecutarlos.

## Observaciones no bloqueantes

### OBS-1 — Asignación desde el pool sin responsable

La migración de seguimientos se ejecuta solo si existía un responsable anterior. Si un cliente estaba en el pool `Sin asignar`, tenía un seguimiento pendiente creado por el admin y después se asigna a un operativo, ese seguimiento conserva al admin como responsable; el nuevo dueño ve el cliente pero no puede gestionarlo salvo que el admin lo reasigne.

No constituye acceso cruzado ni impide el alcance central de JUA-43, pero la afirmación de que cartera y recordatorios siempre viajan juntos debe limitarse al traspaso entre responsables. Conviene decidir si, al sacar un cliente del pool, deben migrarse también sus seguimientos pendientes o mostrarse explícitamente como tareas delegadas.

### OBS-2 — Agregados auxiliares aún globales

Como señaló el dictamen v1, `etiquetas.listar` continúa devolviendo conteos de etiqueta de todo el negocio y `usuarios.equipo` la carga de clientes de cada miembro a un operativo. No exponen fichas individuales y no forman parte de B-1 a B-5, pero son métricas de otras carteras. Se recomienda resolver la política de visibilidad antes de ampliar estos indicadores.

### OBS-3 — Cobertura y limpieza del driver de servidor

La prueba B-3 confirma que no cambian clientes ajenos, pero no fuerza un cliente propio vencido para demostrar la transición positiva. Además, la creación inicial de fixture ocurre antes del bloque `try/finally`; si fallara esa fase, la limpieza no se ejecutaría. Son mejoras de evidencia: usar un cliente propio con transición esperada y envolver toda la preparación en el `try/finally`.

### OBS-4 — Evidencia aún temporal

Drivers y reportes siguen bajo `tmp/`, ignorado por Git. Antes del cierre productivo, la evidencia de la corrida viva debe sanitizarse y copiarse al directorio versionado `auditorias/2026-07-16-cartera-jua43/`, como propone el acta candidata.

## Condiciones para el despliegue

Se autoriza el paso a verificación en vivo bajo el plan indicado, con estas salvaguardas:

1. Desplegar primero las funciones de Convex y después el frontend.
2. Usar un segundo operativo QA revocable y no modificar las cuentas demo principales.
3. Probar en vivo el rechazo de cambio de etapa, gestión de seguimiento, búsqueda de duplicado y métricas fuera de cartera; comprobar además la migración tras reasignación.
4. Revocar el QA, limpiar fixtures y archivar reporte/capturas sanitizados antes de cerrar JUA-43.

## Constancia de auditoría

La revisión fue de solo lectura sobre Git, código, drivers, reportes, capturas y documentación oficial. No se modificó código de aplicación, configuración, datos de desarrollo o producción, despliegues, repositorio remoto ni Linear.
