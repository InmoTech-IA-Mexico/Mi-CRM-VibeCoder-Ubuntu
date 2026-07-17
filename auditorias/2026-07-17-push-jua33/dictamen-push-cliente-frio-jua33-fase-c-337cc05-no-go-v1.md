# Acta de auditoría — Alerta push de cliente frío (JUA-33) · Fase C · v1

Fecha: 2026-07-16  
Commit auditado: `337cc05`  
Base funcional: `3e2af0f` (Fases A+B remediadas)  
Base productiva declarada: `2136a30`  
Estado revisado: candidato local; no desplegado por esta auditoría  
Veredicto: **NO-GO**

---

## Resultado

La detección en el borde de transición, el cálculo horario por zona IANA y los endurecimientos pendientes de A+B están bien encaminados. La cola no cumple aún condiciones centrales del PRD ni el protocolo de entrega que el dictamen de diseño exigía.

No se autoriza desplegar ni considerar JUA-33 funcionalmente completo. Debe remediarse la revalidación previa al envío, la política de destinatarios y la semántica de reclamación/reintento; además, el deep-link a ficha no está probado y el acta candidata lo afirma erróneamente.

## Integridad y comprobaciones locales

- `337cc05` es hijo directo de `3e2af0f`.
- Delta: siete archivos, con tabla aditiva `notificacionesPush`, helpers de cola, cron, emisor y endurecimientos de subscriptions.
- `git diff --check 3e2af0f..337cc05` no reportó errores.
- `npx tsc --noEmit` y `npx eslint .` finalizaron correctamente. `npm run build` compiló las 25 rutas tras repetirse fuera del sandbox; el primer intento solo fue impedido por la descarga de fuentes Google de Next.js.
- No se ejecutaron mutaciones, acciones, cron ni drivers contra Convex desde esta auditoría.

## Aspectos correctos

- `transicionarClientes` encola en el borde de estado Prospecto/Activo → Inactivo, ruta compartida por cron global y sincronización por sesión.
- La cola soporta una fila por destinatario: para un cliente sin responsable, el encolado obtiene los admins activos del negocio. Esto evita el bloqueo de múltiples destinatarios que tenía el primer diseño.
- El horario `[09:00, 20:00)` se calcula con `partesLocales` y la zona horaria almacenada del negocio. El cron horario a minuto 15 permite cubrir las zonas sin enviar durante la noche.
- Los endurecimientos de A+B son reales: URL HTTPS parseada, claves base64url, límite aplicado tras reasignación e invalidación de subscription por ID + clave leída.

## Bloqueantes

### B-1 — Falta revalidar el recordatorio próximo y el destinatario vigente antes de enviar

`notificaciones.paraEnviar` solo comprueba que el cliente exista, no esté en papelera y continúe en estado `inactivo`. No vuelve a calcular `recordatorioProximoIds` ni consulta seguimientos. Por tanto, si se crea un recordatorio dentro de los próximos tres días después de encolar pero antes del flush, la notificación se envía pese a que el requisito dice que **no debe enviarse**.

Tampoco revalida que el destinatario siga activo ni que siga siendo el responsable actual. Si el cliente se reasigna durante la espera, se avisa al responsable anterior; si este se revoca, se intenta procesar su entrega y después se marca como enviada aunque ya no tenga subscriptions.

**Remediación requerida:** una mutación interna de reclamación debe releer, de manera transaccional, cliente, recordatorios próximos, usuario destinatario, negocio y política vigente. Debe descartar con una razón cuando haya seguimiento próximo, el cliente sea obsoleto, el destinatario esté inactivo o ya no corresponda. Definir y probar si una reasignación redirige al nuevo responsable o descarta el evento original.

### B-2 — “Marta opt-in” no está implementado

La decisión de producto declara pool → admin y Marta opt-in. La implementación encola a **todos** los admins activos del pool sin una preferencia por usuario/negocio, y la mera existencia de una subscription de dispositivo funciona de hecho como aceptación de todas las alertas.

Esto reincide en el bloqueo de diseño: dispositivo de transporte y política de notificación son entidades distintas. No se puede expresar “solo pool”, “todo el negocio” o “ninguna” por Marta, ni mantener esa elección entre dispositivos.

**Remediación requerida:** incorporar una preferencia persistente por usuario/negocio para `cliente_frio` y usarla al determinar destinatarios. La subscription solo indica dónde entregar; no quién desea recibir qué clase de alerta.

### B-3 — La cola carece de reclamación, estado de envío y reintento

`paraEnviar` devuelve todos los pendientes a una acción Node; esta llama al servicio externo y después marca cada fila como `enviada` sin examinar `enviadas`, `fallidas` o `caducadas` del resultado. Un destinatario sin dispositivos, una red temporalmente fallida o todas las entregas fallidas quedan registrados como enviados. Si la acción cae tras enviar y antes de marcar, el siguiente flush repite el push; si falla antes, no hay política explícita de recuperación.

Los únicos estados son `pendiente`, `enviada` y `descartada`: no hay `enviando`, lease, contador, siguiente reintento ni razón de resultado. Esto es precisamente el protocolo que el dictamen de diseño calificó como requerido antes de automatizar.

**Remediación requerida:** reclamar en una mutación interna un lote limitado, moverlo a `enviando` con lease; enviar desde una `internalAction`; registrar éxito, caducidad, fallo transitorio y reintentos limitados/backoff mediante mutación interna. Definir de forma explícita que el evento CRM es único pero la entrega externa es best-effort y puede duplicarse excepcionalmente tras recuperación. Las acciones no tienen acceso directo a base de datos y las acciones programadas se ejecutan como máximo una vez, por lo que este estado durable es necesario. [Convex Actions](https://docs.convex.dev/functions/actions), [Scheduler guarantees](https://docs.convex.dev/api/interfaces/server.Scheduler)

### B-4 — El deep-link a ficha no está validado; la evidencia lo contradice

El acta candidata declara que la prueba real abre la ficha del cliente. El reporte preservado `reporte-entrega-real-manual-dev.txt` afirma que, al tocar la notificación de prueba, se abrió **Inicio**. Es coherente con el código de Fase B: `enviarPrueba` manda `url: "/inicio"`.

La Fase C sí construye `/clientes/[id]`, pero el flujo automático probado tuvo cero dispositivos y no ejerció la entrega ni el clic. Por tanto, el criterio “tocarla abre la ficha del cliente” no está demostrado.

**Remediación requerida:** ejecutar una entrega real de una fila automática a un dispositivo suscrito y verificar el clic hacia la ficha correcta, incluida la respuesta segura si el cliente se reasigna o deja de ser visible por cartera. Corregir el acta para no atribuir esa prueba a la notificación de prueba de Inicio.

## Observaciones no bloqueantes

### OBS-1 — Episodio de inactividad aún es implícito

La deduplicación evita solo filas pendientes por cliente/destinatario. Tras una entrega marcada, una reactivación y nuevo enfriamiento crean una fila nueva, lo cual es deseable; pero si el cliente se reactiva y vuelve a Inactivo antes de vaciar una pendiente vieja, esa fila se reutiliza de facto sin identificar el episodio. Un `eventoId` o marca de transición permite mantener trazabilidad por ciclo y simplifica la reclamación de B-3.

### OBS-2 — Escala y limpieza de datos QA

`paraEnviar` recoge todas las pendientes y hace lecturas por fila. Antes de crecer, debe reclamar lotes con un índice por estado/instante elegible. Además, el reporte dev declara como residuo una fila `notificacionesPush` enviada y que el cliente demo quedó Inactivo; no es una restauración completa del estado previo. Los fixtures y resultados de prueba deben limpiarse o quedar claramente aislados.

### OBS-3 — El guard nocturno y obsoletas no tienen evidencia dinámica

El reporte cubre la rama positiva a las 19:59, pero el guard nocturno, recordatorio creado después de encolar, reasignación, revocación y descarte obsoleto solo se declaran por revisión de código. Los cinco casos deben pasar a driver/reportes antes del cierre.

## Condiciones para levantar el NO-GO

1. Implementar revalidación transaccional de recordatorio próximo, cliente, destinatario activo y responsabilidad/política vigente al reclamar la entrega.
2. Implementar preferencias de alerta por usuario/negocio; en particular, el opt-in de Marta/pool.
3. Implementar reclamación, `enviando`, lease y resultado/reintento durable, y usar el resultado real del emisor para no marcar falsamente como enviada una entrega fallida.
4. Ejecutar prueba real del evento automático con destino `/clientes/[id]` y corregir la afirmación documental actual.
5. Añadir evidencia automatizada para guard nocturno, seguimiento tardío, reasignación, revocación, obsolescencia y recuperación de fallo.

## Constancia de auditoría

La revisión fue de solo lectura sobre Git, código, reportes y documentación oficial. No se modificó código de aplicación, datos de desarrollo o producción, secretos, despliegues, repositorio remoto ni Linear. Esta acta es el único archivo creado por la auditoría.
