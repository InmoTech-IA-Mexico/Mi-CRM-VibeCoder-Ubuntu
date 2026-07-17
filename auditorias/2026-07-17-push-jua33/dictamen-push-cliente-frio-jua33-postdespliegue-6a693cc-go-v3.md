# Acta de auditoría — Alerta push de cliente frío (JUA-33) · postdespliegue · v3

Fecha: 2026-07-17
Commit auditado: `6a693cce4be986315b6e3261651235822bc0717b`
Estado corroborado: Convex `glad-bird-297` y Railway en producción
Referencia: dictamen Fase C global v2 = **GO con observaciones no bloqueantes**
Veredicto: **CIERRE PRODUCTIVO RATIFICADO — GO POSTDESPLIEGUE CON OBSERVACIONES DOCUMENTALES NO BLOQUEANTES**

---

## Resultado

Se ratifica el despliegue de JUA-33. No se observa una condición que requiera rollback, hotfix o reapertura funcional.

La evidencia declara una entrega automática real en producción, con el contenido del cliente esperado y navegación a su ficha. Las comprobaciones independientes confirman el commit de Railway, el contrato de funciones en Convex, la ausencia de `QA_HELPERS` en producción y la disponibilidad de los activos PWA requeridos.

## Corroboración independiente

### Git y Railway

- El árbol local estaba limpio; `HEAD`, `main` y `origin/main` apuntan a `6a693cc`.
- Railway registra el deployment `ed8f1c22-08bc-4b78-9d45-c1b931d0580c` en estado **SUCCESS**.
- El metadato del deployment acredita rama `main` y el hash completo `6a693cce4be986315b6e3261651235822bc0717b`.
- Los activos públicos respondieron HTTP 200: `/sw.js`, `/manifest.webmanifest` e `/icon-192.png`.

### Convex

`npx convex function-spec --prod` terminó correctamente contra `https://glad-bird-297.convex.cloud` y contiene:

- `push.guardarSubscription`, `push.borrarSubscription`, `push.miPreferenciaFrio`, `push.guardarPreferenciaFrio` y `push.misDispositivos`.
- `pushEnvio.enviarPrueba` y `pushEnvio.flushNotificaciones`.
- `notificaciones.reclamarLote` y `notificaciones.registrarResultado` como funciones internas.

La consulta específica de entorno confirma que `QA_HELPERS` **no está definida** en producción. Las funciones QA permanecen presentes como internas, pero su guard de entorno queda inerte conforme al diseño auditado.

La especificación de funciones acredita firmas y visibilidad desplegadas; no expone por sí sola el valor de secretos VAPID ni la configuración detallada de índices o crons. No se consultaron ni reprodujeron secretos.

## Evidencia funcional de producción revisada

El acta de despliegue declara que una cuenta QA revocable recibió la alerta generada por el flujo automático, no por el botón de prueba. Registra:

- `flushNotificaciones` con una reclamación y una entrega sin fallo.
- Notificación con título **«⚠️ Cliente frío»** y el nombre del cliente esperado.
- Apertura de la ficha de `Beltrán & Co`, no de `/inicio`, al tocarla.
- Restauración del cliente y revocación del QA; suscripciones eliminadas por la propia desactivación.

Esto es consistente con el código desplegado: el emisor automático construye `/clientes/[id]`, mientras que el botón de prueba usa deliberadamente `/inicio`; el Service Worker navega a la URL contenida en el payload.

## Revisión de salvaguardas

| Salvaguarda | Estado |
|---|---|
| Claves VAPID fuera de Git | Respaldada por el procedimiento declarado; no se inspeccionaron valores. |
| `QA_HELPERS` ausente en prod | **Corroborada independientemente.** |
| Convex antes que frontend | Respaldada por el acta; contrato Convex y deployment Railway corroborados después. |
| Entrega automática y deep-link reales | Respaldados por evidencia manual de producción y coherentes con el código. |
| QA revocable y restauración | Declarado; no se repitieron consultas de datos para no tocar producción. |

## Observaciones no bloqueantes

### OBS-1 — El cron horario no se ejercitó de forma distinguible

La prueba en producción invocó `flushNotificaciones` sobre una alerta creada automáticamente; acredita detección, reclamación, emisión y deep-link. No demuestra por sí sola que el scheduler horario haya ejecutado una pasada autónoma en producción. El cron existe en el código desplegado y el deployment de Convex lo incluye, pero el acta debe describir la evidencia con precisión: «flujo automático con flush invocado para la verificación», no «cron horario observado en vivo».

**Sugerencia:** conservar en el próximo ciclo un registro de ejecución del cron o esperar una pasada programada sobre un fixture controlado.

### OBS-2 — Fila terminal QA retenida

Permanece una fila terminal de la prueba para el usuario QA inactivo. No conserva una suscripción activa ni habilita una entrega futura; es un residuo histórico acotado. Debe incluirse en el inventario de datos QA y definirse una retención/purga de notificaciones terminales si el volumen crece.

### OBS-3 — Evidencia durable y precisión de limpieza

Los reportes siguen bajo `tmp/`. Antes de archivar el cierre, deben copiarse sanitizados a `auditorias/2026-07-17-push-jua33/`. Además, la prueba modificó temporalmente datos de dev y producción, aunque fueran restaurados: la formulación correcta es «sin residuos funcionales salvo la fila terminal documentada», no «sin cambios persistentes».

### OBS-4 — Mejoras de resiliencia y escala previamente aceptadas

Se mantienen como mejora futura la poda de endpoints tras fallos de red repetidos y un índice de cola que incluya estado y próximo intento. No afectan el comportamiento actual ni el cierre productivo.

## Dictamen de cierre

JUA-33 puede permanecer desplegada y marcarse como **Done** una vez que se archive la evidencia sanitizada y se registre la fila terminal QA. No se requiere rollback ni modificación funcional inmediata.

## Constancia de auditoría

La auditoría realizó solo consultas de lectura a Git, Railway, Convex y activos públicos. No se modificó código, configuración, secretos, datos de desarrollo o producción, despliegues, repositorio remoto ni Linear. Esta acta es el único archivo creado por la auditoría.

---

## Cierre de observaciones (respuesta del implementador, 2026-07-17)

- **OBS-1 — RESUELTA con evidencia:** los logs de Convex prod acreditan que el scheduler ejecutó
  `pushEnvio:flushNotificaciones` con `caller: "Cron"` en **2026-07-17 21:15:01 UTC** y **22:15:01 UTC**
  (coincidiendo con `minuteUTC: 15`); la verificación manual figura aparte a las 22:42:48 UTC
  (`caller: HttpApi / instance_admin`). El acta de despliegue se corrigió: el disparo del envío en la
  prueba fue **manual** y, además, el cron quedó **observado en vivo**.
- **OBS-2 — Registrada:** la fila terminal QA se documenta en el inventario del acta de despliegue
  (usuario QA inactivo, sin suscripción; retención ligada a OBS-4).
- **OBS-3 — Aplicada:** evidencia sanitizada archivada en `auditorias/2026-07-17-push-jua33/`
  (commit `a5fde04`, pusheado); redacción ajustada a «sin residuos funcionales salvo la fila terminal
  documentada» en las actas de despliegue y B-4.
- **OBS-4 — Diferida** como mejora futura (poda de endpoints tras N fallos de red; índice de cola por
  estado + próximo intento). No condiciona el cierre.
