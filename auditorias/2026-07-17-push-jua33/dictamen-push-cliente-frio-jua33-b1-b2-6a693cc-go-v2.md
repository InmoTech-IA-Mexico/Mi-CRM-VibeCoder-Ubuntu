# Acta de auditoría — Alerta push de cliente frío (JUA-33) · B-1/B-2 · v2

Fecha: 2026-07-17  
Commits revisados: `b08d399` + `5826b4b` + `70e222d` + `4fff2b5` + `6a693cc`  
Estado revisado: candidato local y Convex dev; sin despliegue realizado por esta auditoría  
Referencia: dictamen de avance B-1/B-2 v1 = **NO-GO MANTENIDO** por pérdida de identidad de audiencia  
Veredicto: **B-1, B-2 Y B-3 CERRADOS — EL NO-GO GLOBAL SE MANTIENE HASTA CERRAR B-4**

---

## Resultado

Se levanta el bloqueante que impedía considerar cerradas B-1 y B-2. La remediación `6a693cc` conserva por fila la audiencia que justificó el aviso y la revalida contra la preferencia vigente del destinatario antes de reclamarla para envío. Ya no puede redirigir una entrega de administración al responsable ni convertirla en un duplicado.

La cola durable B-3 permanece cerrada con `b08d399` y `5826b4b`. Sin embargo, JUA-33 no está autorizado para despliegue: B-4 —recepción automática real y deep-link a la ficha correcta— continúa pendiente.

## Integridad y comprobaciones locales

- `6a693cc` es hijo directo de `4fff2b5`; la serie remonta a `337cc05`.
- El delta `4fff2b5..6a693cc` modifica cinco archivos: `convex/clientes.ts`, `convex/inactividad.ts`, `convex/notificaciones.ts`, `convex/push.ts` y `convex/schema.ts` (`+106 −37`).
- `git diff --check 4fff2b5..6a693cc` no reportó errores y el árbol se encontró limpio.
- `npx tsc --noEmit`, `npx eslint .` y `npm run build` finalizaron correctamente; el build generó 25 rutas.
- No se ejecutaron drivers, mutaciones de Convex, despliegues, `git push` ni acciones en Linear durante esta auditoría.

## Revisión del bloqueante: la reclamación pierde la audiencia

**Estado: RESUELTO.**

La causa del NO-GO anterior era real: `revalidarDestino` trataba toda fila de un cliente asignado como si perteneciera a su responsable actual. Con una fila del responsable por cartera y otra del administrador por preferencia de negocio, ambas terminaban dirigidas al responsable; el administrador perdía su alerta y el responsable podía recibir dos.

La remediación establece dos controles complementarios:

- `prefFrioEfectiva` / `prefFrio` en `convex/inactividad.ts` es la fuente única de la preferencia efectiva. Encolado y reclamación reutilizan la misma regla. El valor por defecto del observador es ahora `ninguna`.
- Cada `notificacionesPush` materializa `audiencia`: `responsable`, `admin_negocio` o `admin_pool`. Para un administrador que también sea responsable prevalece `admin_negocio`, la vía estable que no depende de conservar la cartera.

Al reclamar, la validación es específica de audiencia y ocurre dentro de la mutación que toma el lease:

- `responsable` se redirige únicamente al responsable actual, activo y con preferencia `cartera` o `negocio`.
- `admin_negocio` conserva al administrador original y exige que siga activo, administrador y con preferencia `negocio`.
- `admin_pool` conserva al administrador original y exige que el cliente siga sin responsable, además de un administrador activo con preferencia `pool`.

En los tres casos se conserva la revalidación del recordatorio próximo. Las filas históricas sin audiencia se descartan como `sin_audiencia`; al no existir despliegue previo de esta tabla en producción, esta compatibilidad no presenta migración productiva pendiente.

## Evidencia revisada

El driver `tmp/drivers-jua33/driver-36-audiencia.py` y su reporte sanitizado declaran **7 PASS / 0 FAIL**. La auditoría revisó el código y el reporte sin ejecutarlos, porque preparan y modifican datos en Convex dev.

La cobertura corresponde a los escenarios exigidos en el dictamen anterior:

- Responsable de cartera y administrador con `negocio`: dos filas, dos destinatarios y dos audiencias distintas.
- Administrador que cambia de `negocio` a `ninguna`: descarte sin redirección ni duplicado al responsable.
- Reasignación: la entrega de responsable pasa al dueño nuevo; `admin_negocio` permanece en el administrador original.
- `admin_pool`: descarte si el cliente deja el pool o si la preferencia se vuelve `ninguna`.
- Responsable inactivo y pool sin administrador válido: ambos descartes se ejercitan dinámicamente mediante el helper QA reversible.

La clasificación B-3 se conserva: reclamación con lease, recuperación, reintento con backoff, resultado idempotente por intento y descarte tras agotarse los intentos. La entrega a un servicio Push externo sigue siendo de mejor esfuerzo, con duplicación excepcional posible después de recuperar un lease, una semántica explícitamente documentada.

## Observaciones no bloqueantes

### OBS-1 — Helpers de QA incluidos en funciones internas

Los helpers QA, incluido `qaSetEstadoUsuario`, quedan condicionados a `QA_HELPERS=1` y son `internal*`; no son invocables desde la aplicación pública. Antes de cualquier despliegue debe comprobarse que `QA_HELPERS` no exista en Convex producción y que ninguna ruta de aplicación los llame.

### OBS-2 — B-4 sigue siendo un requisito real, no una inferencia de código

El payload automático forma `/clientes/[id]` y el Service Worker navega a su `url`, pero eso no sustituye una prueba de dispositivo. La evidencia anterior de «Enviar notificación de prueba» abre `/inicio` y no acredita el flujo automático.

## Estado consolidado

| Bloqueante | Estado |
|---|---|
| B-1 — revalidación de destinatario y audiencia vigente | Cerrado con `6a693cc` |
| B-2 — preferencia persistente respetada en encolado y reclamación | Cerrado con `6a693cc` |
| B-3 — cola durable, lease y resultado real | Cerrado con `b08d399` + `5826b4b` |
| B-4 — alerta automática real y deep-link a ficha | **Pendiente** |

## Condición para levantar el NO-GO global

Debe ejecutarse, documentarse y conservarse una prueba real en un dispositivo suscrito que:

1. Use el flujo automático de cliente frío, no el botón de prueba.
2. Compruebe la recepción con título y cuerpo del cliente esperado.
3. Toque la notificación y confirme que abre `/clientes/[id]` de ese cliente, no `/inicio`.
4. Limpie o restaure el fixture y no deje suscripciones, preferencias o alertas QA residuales.

Solo después procede una reauditoría global de JUA-33. Aun con B-4 cerrada, el eventual despliegue requiere las claves VAPID cargadas por un operador autorizado y verificación posterior en producción.

## Constancia de auditoría

La revisión fue exclusivamente de lectura sobre Git, código, drivers y reportes. No se modificó código de aplicación, configuración, secretos, datos de desarrollo o producción, despliegues, repositorio remoto ni Linear. Esta acta es el único archivo creado por la auditoría.
