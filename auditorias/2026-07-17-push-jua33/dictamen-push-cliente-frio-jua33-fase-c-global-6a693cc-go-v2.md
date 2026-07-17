# Acta de auditoría — Alerta push de cliente frío (JUA-33) · Fase C global · v2

Fecha: 2026-07-17  
Commits auditados: `337cc05` + `b08d399` + `5826b4b` + `70e222d` + `4fff2b5` + `6a693cc`  
Base productiva declarada: `2136a30`  
Estado revisado: candidato local y Convex dev; no desplegado por esta auditoría  
Referencia: dictamen Fase C v1 = **NO-GO** por B-1, B-2, B-3 y B-4  
Veredicto: **GO CON OBSERVACIONES NO BLOQUEANTES — AUTORIZABLE PARA DESPLIEGUE CONTROLADO**

---

## Resultado

Se levanta el NO-GO global de JUA-33 Fase C. Los cuatro bloqueantes del dictamen v1 tienen remediación y evidencia suficiente:

- B-1 y B-2: la audiencia se materializa por entrega y se revalida con la preferencia vigente.
- B-3: la cola incorpora reclamación, lease, recuperación e intentos con resultado durable.
- B-4: el flujo automático real llegó a un navegador suscrito y, al tocarlo, abrió la ficha del cliente esperado.

El GO no ejecuta ni implica un despliegue automático. Antes de producción deben cargarse las claves VAPID por un operador autorizado y aplicarse las salvaguardas de este dictamen.

## Integridad y comprobaciones locales

- `6a693cc` es la cabecera local de la serie y desciende de `337cc05` a través de las remediaciones B-1, B-2 y B-3.
- El delta `337cc05..6a693cc` afecta ocho archivos, principalmente la cola, preferencias, suscripciones, emisor y UI de notificaciones (`+414 −80`).
- `git diff --check 337cc05..6a693cc` no reportó errores y el árbol estaba limpio al inicio de la revisión.
- Se ejecutaron nuevamente `npx tsc --noEmit`, `npx eslint .` y `npm run build`: todos finalizaron con código 0. El build generó 25 rutas.
- No se ejecutaron drivers, mutaciones de Convex, despliegues, `git push` ni acciones en Linear durante esta auditoría.

## Revisión de los bloqueantes

### B-1 — Destinatario revalidado y audiencia preservada

**Estado: RESUELTO.**

`notificacionesPush.audiencia` conserva si la fila nació para `responsable`, `admin_negocio` o `admin_pool`. `revalidarDestino`, dentro de la misma mutación que reclama el lease, aplica una regla distinta a cada audiencia:

- Responsable: se redirige solo al dueño actual, activo y con preferencia compatible.
- Administrador de negocio: conserva al administrador original, activo, con rol admin y preferencia `negocio`.
- Administrador del pool: conserva al administrador original únicamente mientras el cliente siga sin responsable y la preferencia sea `pool`.

La revalidación también vuelve a comprobar un recordatorio próximo. Por tanto, la reasignación, un usuario desactivado, una preferencia retirada o un seguimiento creado mientras la alerta esperaba no producen un envío improcedente.

### B-2 — Preferencia independiente de la suscripción

**Estado: RESUELTO.**

`prefFrioEfectiva` es la fuente compartida para encolar y reclamar. El dispositivo solo proporciona el transporte; la política se guarda por usuario. Operativo usa `cartera` por defecto, admin queda en `ninguna` hasta optar expresamente, y observador queda en `ninguna`.

El reporte B-1/B-2 declara **7 PASS / 0 FAIL**, incluidos los escenarios de administrador `negocio` que pasa a `ninguna`, reasignación, pool y destinatarios inactivos.

### B-3 — Cola durable y semántica de entrega

**Estado: RESUELTO.**

La cola usa `pendiente`, `enviando`, `enviada` y `descartada`, con lease, contador, próximo intento y razón terminal. Un lease vencido se recupera; un fallo transitorio se reintenta con backoff; el resultado se aplica solo al mismo intento reclamado. Las respuestas 404/410 eliminan la suscripción y se clasifican como `suscripcion_caducada`, no como entrega.

El reporte dinámico declara **7 PASS / 0 FAIL** e incluye recuperación de lease, agotamiento de reintentos e idempotencia frente a un resultado tardío.

La semántica es correctamente de mejor esfuerzo: tras recuperar un lease puede haber una duplicación excepcional en un dispositivo, mitigada por el `tag` de la notificación. No se promete entrega exactamente una vez frente al servicio externo.

### B-4 — Entrega automática real y deep-link

**Estado: RESUELTO.**

La evidencia `reporte-B4-entrega-real-dev.txt` distingue expresamente este recorrido del botón de prueba:

1. Sofía Beltrán pasó por la transición automática a cliente frío y generó una fila para Carlos con audiencia `responsable`.
2. `flushNotificaciones` reclamó esa fila y terminó con `{ reclamadas: 1, enviadas: 1, conFallo: 0 }`, estado `enviada` y resultado `entregada`.
3. En el navegador real se recibió el título **«⚠️ Cliente frío»** y el cuerpo esperado con el nombre de Sofía.
4. Al tocarla se abrió la ficha de Sofía, no Inicio.
5. El informe declara la restauración del fixture, cero notificaciones y cero suscripciones QA remanentes; las preferencias volvieron a sus valores declarados.

La revisión estática coincide con la evidencia: el emisor automático construye `url: /clientes/${clienteId}`, mientras `enviarPrueba` usa deliberadamente `/inicio`; el Service Worker navega a la URL del payload. La errata incorporada al informe de 2026-07-16 corrige la atribución anterior y evita confundir ambos flujos.

## Observaciones no bloqueantes

### OBS-1 — Suscripción inalcanzable con error de red

La prueba detectó una suscripción vieja que fallaba sin código HTTP. La política actual la trata como transitoria y la reintenta hasta el máximo; solo 404/410 eliminan automáticamente la suscripción. Es una elección razonable, aunque un endpoint permanentemente muerto consume tres intentos. Puede evaluarse una poda por fallos consecutivos en una mejora posterior.

### OBS-2 — Helpers QA y verificación previa al despliegue

Los helpers QA son internos y requieren `QA_HELPERS=1`. Antes de desplegar debe verificarse que esa variable no exista en Convex producción. También debe confirmarse que ninguna ruta de la aplicación invoca esos helpers.

### OBS-3 — Redacción de la constancia B-4

La evidencia B-4 afirma que no modificó datos persistentes. La prueba sí modificó temporalmente datos de Convex dev (suscripción, alerta y fixture), aunque el reporte declara que fueron restaurados y no dejó residuos. Conviene sustituir esa frase por «sin cambios persistentes remanentes» para precisión documental.

### OBS-4 — Conservación de evidencia y escala

Los reportes permanecen en `tmp/`, ignorado por Git. Tras la verificación productiva deben sanitizarse y archivarse en `auditorias/2026-07-17-push-jua33/`. Antes de un crecimiento relevante, conviene indexar la cola por estado y próximo intento para no recorrer todas las pendientes.

## Salvaguardas para el despliegue controlado

1. Un operador autorizado carga `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en Railway y `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` en Convex producción; ningún secreto se incorpora a Git, drivers, capturas o actas.
2. Confirmar en producción que `QA_HELPERS` está ausente antes de desplegar las funciones.
3. Desplegar primero Convex (esquema, funciones y cron), verificar contra producción que el contrato de `push`, `notificacionesPush` y el cron existe, y solo después publicar el frontend con la clave pública de Railway.
4. Repetir en producción una prueba automática de dispositivo real —recepción, ficha correcta y limpieza— usando una cuenta QA revocable y sin alterar las cuentas demo principales.
5. Revocar o limpiar la cuenta QA, las suscripciones, preferencias, alertas y fixtures; archivar un reporte sanitizado y las capturas antes de cerrar JUA-33.

## Dictamen de cierre

JUA-33 puede avanzar a despliegue controlado y verificación en producción. No procede un rollback ni una remediación adicional antes de ese paso.

El cierre definitivo de la issue queda sujeto a la verificación viva postdespliegue y al archivo durable de la evidencia, no a esta comprobación de dev.

## Constancia de auditoría

La revisión fue solo de lectura sobre Git, código, evidencia manual y reportes. No se modificó código de aplicación, configuración, secretos, datos de desarrollo o producción, despliegues, repositorio remoto ni Linear. Esta acta es el único archivo creado por la auditoría.
