# Acta de auditoría — Seguimiento post-venta automático (JUA-37) · v1

Fecha: 2026-07-15  
Commit auditado: `8032984`  
Base productiva declarada: `338e28c`  
Estado al auditar: construido y verificado en local + desarrollo de Convex. **No desplegado.**  
Veredicto: **GO CON OBSERVACIONES NO BLOQUEANTES**

---

## Resultado del dictamen

No se encontraron regresiones funcionales, de seguridad, integridad transaccional o aislamiento por negocio que bloqueen el paso a producción de `8032984`.

Se concede **luz verde explícita para que el responsable autorizado ejecute el despliegue**, seguido del ciclo de verificación productiva descrito en esta acta.

## Integridad y alcance revisados

- `8032984` es hijo directo de `338e28c`.
- El árbol de trabajo se encontraba limpio durante la auditoría.
- El diff contiene exactamente:
  - `convex/oportunidades.ts`.
  - `convex/schema.ts`.
  - `eslint.config.mjs`.
- El total coincide con `+79/−4`.
- `git diff --check 338e28c..8032984` no reportó errores.
- No se añadió una interfaz nueva.

## Revisión funcional

### Creación del seguimiento post-venta

Al producirse una transición desde cualquier etapa distinta de Ganada hacia `ganada`, `cambiarEtapa` crea un seguimiento con:

- Destino cliente.
- Cliente y oportunidad vinculados.
- Título y descripción post-venta.
- Fecha igual al día local del negocio más 15 días.
- Sin hora, como recordatorio de día completo.
- Responsable igual al usuario que ejecuta el cierre.
- Prioridad media.
- Frecuencia de una sola vez.
- Estado pendiente.
- Origen interno `post_venta`.

La creación del seguimiento forma parte de la misma mutación que cambia la etapa. Si falla cualquiera de las operaciones, Convex revierte la transacción completa y no deja una oportunidad ganada sin su seguimiento ni un seguimiento sin el cambio de etapa correspondiente.

### Ausencia de duplicados

Antes de insertar, el servidor busca todos los seguimientos pendientes con:

- `origen === "post_venta"`.
- La misma oportunidad.
- Estado `pendiente`.

Si encuentra alguno, no crea otro. La lectura y la escritura dentro de la transacción también protegen frente a ejecuciones concurrentes.

Volver a guardar Ganada sobre una oportunidad que ya estaba ganada no crea un seguimiento, porque la programación depende de una transición real hacia esa etapa.

### Cancelación automática

Al salir de Ganada se cancelan todos los seguimientos post-venta de la oportunidad que continúen pendientes.

Los seguimientos realizados no se modifican. Si la oportunidad vuelve posteriormente a Ganada, puede crearse un nuevo seguimiento, ya que los anteriores cancelados no cuentan como pendientes.

La eliminación de una oportunidad también cancela previamente sus seguimientos post-venta pendientes para impedir que continúen apareciendo como tareas activas.

### Caminos que pueden alcanzar Ganada

La creación de oportunidades solo permite etapas iniciales abiertas. En el código productivo revisado, el cambio a Ganada pasa por `oportunidades.cambiarEtapa`; no se identificó otra mutación que modifique directamente la etapa.

Registrar una venta mediante `ventas.crear` no cambia automáticamente la oportunidad. Este dictamen cubre el disparador definido en el alcance: **marcar una oportunidad como Ganada**.

## Fecha y zona horaria

La implementación obtiene la fecha actual mediante `partesLocales(Date.now(), zonaHoraria)` y construye la medianoche del día local más 15 días mediante `epochDeLocal`.

Se corroboró independientemente que:

`1785391200000` = **30 de julio de 2026, 00:00:00, America/Mexico_City**.

La lógica existente de la agenda selecciona seguimientos pendientes cuya fecha corresponda al día consultado o sea anterior. Por tanto, el seguimiento aparecerá el día programado y después se mostrará como vencido mientras continúe pendiente.

## Schema e integración existente

El campo `origen` es opcional y limitado al literal `post_venta`, por lo que el cambio de schema es aditivo y compatible con los registros existentes.

La mutación pública `seguimientos.crear` no acepta `origen`; los usuarios no pueden etiquetar manualmente un seguimiento como automático mediante la API normal.

Las operaciones existentes de reprogramación y cancelación preservan el campo. Los permisos continúan siendo los de JUA-24: responsable asignado o administrador.

Se considera correcta la exclusión de `tmp/**` de ESLint porque contiene actas y drivers archivados, está fuera de Git y no forma parte del código ejecutable de la aplicación.

## Evidencia revisada

- El driver `tmp/drivers-jua37/driver-9-postventa.js` existe y pasó la comprobación sintáctica de Node.
- La captura `tmp/capturas-jua37/d9-postventa-ficha.png` acredita visualmente:
  - El seguimiento post-venta en la ficha.
  - Fecha `30 jul`.
  - Menú de gestión.
  - Oportunidad en etapa Ganada.
- La evidencia de servidor documenta creación, contenido, responsable, fecha exacta, deduplicación y cancelación al salir de Ganada.

No se repitieron durante esta auditoría los comandos que pudieran generar artefactos o alterar datos; se revisaron estáticamente el commit y la evidencia preservada.

## Decisiones de alcance aprobadas

Se aprueban para esta liberación:

1. Cancelar automáticamente el post-venta pendiente al salir de Ganada.
2. Asignar como responsable a quien ejecuta el cambio de etapa.
3. Crear el seguimiento sin hora.
4. Programar únicamente en transiciones reales hacia Ganada.
5. No generar retroactivamente seguimientos para oportunidades que ya estaban ganadas antes del despliegue.

## Observaciones no bloqueantes

### OBS-1 — Cobertura de casos límite

No se ejercitó funcionalmente la cancelación al eliminar la oportunidad ni un cálculo de fecha que cruce mes o año.

El código de ambos caminos es directo y el helper utilizado normaliza el desbordamiento de calendario, por lo que no se considera bloqueante.

**Sugerencia:** incorporar a la regresión de servidor una oportunidad desechable que se elimine y una fecha simulada cercana al cierre de mes o año.

### OBS-2 — Escalabilidad de la consulta

La búsqueda de post-ventas pendientes consulta todos los seguimientos del cliente mediante `por_cliente` y luego filtra por oportunidad.

Es adecuado para el volumen actual, pero su costo crecerá con el historial completo del cliente.

**Sugerencia:** si aumenta el volumen, añadir un índice `por_oportunidad` sobre `oportunidadId` y consultar directamente ese rango.

### OBS-3 — Copy después de reprogramar

Si el usuario reprograma manualmente el recordatorio a una fecha distinta, la descripción conservará “Han pasado 15 días”.

No afecta la fecha ni la ejecución del seguimiento.

**Sugerencia:** en una mejora posterior, usar un texto que no dependa del día exacto o actualizar la descripción al reprogramar los recordatorios de origen post-venta.

## Verificación mínima en producción

1. Marcar una oportunidad QA como Ganada.
2. Comprobar que aparece exactamente un seguimiento post-venta pendiente.
3. Verificar título, descripción, responsable, prioridad, vínculo y fecha local +15 días.
4. Confirmar que se puede abrir su gestión desde la ficha.
5. Volver la oportunidad a una etapa no ganada.
6. Confirmar que el seguimiento desaparece de pendientes y queda cancelado.
7. Volver a marcar Ganada y comprobar que se crea un nuevo pendiente sin duplicados.
8. Confirmar que las funciones de Convex corresponden a `8032984`.

Si estas comprobaciones resultan correctas, JUA-37 puede marcarse como Done y registrarse el resultado en Linear.

## Constancia de auditoría

Durante esta revisión no se modificó código, no se desplegaron funciones, no se hizo `git push`, no se alteraron datos de desarrollo o producción y no se ejecutaron acciones en Linear.
