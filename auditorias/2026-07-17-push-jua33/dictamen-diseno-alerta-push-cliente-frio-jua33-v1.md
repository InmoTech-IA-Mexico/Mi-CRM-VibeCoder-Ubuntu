# Acta de auditoría de diseño — Alerta push de cliente frío (JUA-33) · v1

Fecha: 2026-07-16  
Estado auditado: propuesta de diseño; sin código ni despliegue  
Veredicto: **NO-GO DE DISEÑO PARA EL FLUJO AUTOMÁTICO; FASE A SOLO TRAS ACOTAR SUS CONTROLES DE SUSCRIPCIÓN**

---

## Resultado

Web Push con VAPID es una elección válida para este CRM PWA. La condición técnica de iOS/iPadOS —solo una web app agregada a Inicio— es correcta, y el uso de un Service Worker con una acción Node de Convex es compatible con la plataforma.

No se recomienda implementar todavía la cola y el envío automático tal como están descritos. El modelo actual no puede representar sin ambigüedad múltiples destinatarios, preferencias de Marta, ni un nuevo ciclo de enfriamiento; además el envío debe resolver explícitamente la frontera transaccional entre Convex y el servicio externo de Push.

No se revisó ni modificó código para esta acta.

## Corroboración con la aplicación actual

- El punto de enganche propuesto existe: `convex/clientes.ts` centraliza los cambios automáticos en `transicionarClientes`, usado tanto por el cron global como por `sincronizarInactividad`.
- La regla actual ya comprueba Prospecto/Activo, 15 días transcurridos, papelera y recordatorio pendiente en los próximos tres días mediante `debeMarcarseInactivo` y `recordatorioProximoIds`; la futura alerta debe reutilizar esa misma regla.
- El negocio ya conserva `zonaHoraria` y el cron actual se expresa en UTC. El guard de envío puede, por tanto, calcularse correctamente en la zona del negocio.
- El manifiesto PWA actual es válido pero solo declara `favicon.ico`; aún no aporta los iconos 192/512 necesarios para una experiencia de instalación y notificaciones cuidada en móviles.

Apple documenta Web Push estándar para web apps añadidas a Inicio desde iOS/iPadOS 16.4 y exige mostrar una notificación visible al recibir el push; también exige que el permiso se solicite a partir de un gesto del usuario. [Documentación de Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)

Convex permite usar librerías Node mediante `"use node"`, pero esas acciones no tienen `ctx.db`: deben leer y escribir mediante queries y mutations internas. [Acciones de Convex](https://docs.convex.dev/functions/actions), [runtimes de Convex](https://docs.convex.dev/functions/runtimes)

## Bloqueantes de diseño

### B-1 — Destinatarios, preferencias y deduplicación no son representables con la cola propuesta

`notificacionesPush` contiene un único `usuarioId`, mientras que el alcance contempla al responsable, a uno o varios admins para el pool y opcionalmente a Marta para todo el negocio. El índice `por_cliente_tipo` tampoco distingue destinatario: una fila creada para Carlos impediría crear la fila de Marta, o viceversa.

La suscripción de un dispositivo tampoco equivale a una preferencia de negocio. Con `pushSubscriptions` no se puede expresar “Marta recibe solo pool” frente a “Marta recibe todas”, ni aplicar esa decisión de forma consistente en todos sus dispositivos.

**Remediación requerida:** separar al menos:

- un evento de inactividad del cliente; y
- una entrega por destinatario, única por `eventoId + usuarioId`, con su estado;
- una preferencia por usuario y negocio para `cliente_frio` (por ejemplo, `ninguna`, `solo_pool`, `toda_la_cartera_o_negocio`, según la decisión de producto).

Las suscripciones quedan como dispositivos de entrega del usuario, no como la política que decide quién recibe la alerta.

### B-2 — “Una sola vez” falla cuando el cliente se reactiva y vuelve a enfriarse

La propuesta asume que la transición a Inactivo sucede una sola vez. En la aplicación actual, `cambiarEstado` permite volver manualmente un cliente Inactivo a Prospecto o Activo. Si vuelve a cumplir la regla, habrá un nuevo ciclo de enfriamiento legítimo.

Con un dedup persistente por `clienteId + tipo` en pendiente/enviada, el segundo ciclo no avisaría nunca; si se omite el dedup, se arriesgan duplicados concurrentes.

**Remediación requerida:** definir “una vez por ciclo de inactividad”, y materializar un identificador de ciclo estable (por ejemplo, la marca de transición `inactivoEn` o un `eventoId` generado transaccionalmente). La unicidad debe ser por ciclo y destinatario, no por toda la vida del cliente.

### B-3 — La condición de “sin recordatorio próximo” debe volver a validarse al enviar

La cola puede permanecer pendiente hasta la siguiente franja diurna. Entre el cambio de estado y el flush, alguien puede crear un seguimiento dentro de los próximos tres días, reasignar el cliente, mandarlo a papelera o reactivarlo. Enviar sin releer el estado vigente incumpliría el requisito de no avisar cuando ya existe un recordatorio próximo y puede avisar a un responsable obsoleto.

**Remediación requerida:** justo antes de reclamar/enviar, una mutación interna debe comprobar de forma transaccional: cliente del negocio, no eliminado, aún Inactivo, regla actual de recordatorio próxima, destinatario activo y política de destinatario vigente. Si no se cumple, debe dejar la entrega en `descartada` con una razón auditable. Debe decidirse expresamente si una reasignación pendiente redirige el aviso al nuevo responsable o descarta el evento original.

### B-4 — El flujo de acción Node no define reclamación, reintento ni semántica de entrega

Una acción Node puede llamar `web-push`, pero no puede marcar directamente la cola ni leerla con `ctx.db`. Marcar `enviada` después de un POST no resuelve los casos de fallo de red, caída entre el envío y la marca, respuesta parcial entre dispositivos o dos flushes solapados.

No existe garantía de exactamente una vez frente a un servicio Push externo. La propuesta debe elegir y documentar una semántica realista: evento único en el CRM y entrega de mejor esfuerzo, con posible duplicado excepcional al reintentar, o una política estricta de no reintento que puede perder avisos. Hoy no la define.

**Remediación requerida:** una mutación interna reclama un lote limitado y lo mueve a `enviando` con una concesión/lease; una `internalAction` Node envía por dispositivo; otra mutación interna registra éxito, caducidad, error transitorio y reintentos con límite/backoff. Las suscripciones 404/410 se borran; los errores transitorios no deben pasar directamente a `enviada`.

Convex indica que las acciones no tienen acceso directo a base de datos y que las acciones programadas se ejecutan como máximo una vez, sin reintento automático; por ello el estado de la cola debe sostener el protocolo de recuperación. [Contexto de acciones](https://docs.convex.dev/api/interfaces/server.GenericActionCtx), [garantías del scheduler](https://docs.convex.dev/api/interfaces/server.Scheduler)

## Controles necesarios para Fase A

Fase A puede diseñarse y auditarse de forma independiente, pero antes de implementarla debe incluir estos límites:

- La mutación de alta asocia siempre la subscription al usuario y negocio de la sesión; nunca acepta esos IDs desde el navegador.
- `endpoint` debe ser único. Si el mismo perfil del navegador cambia de cuenta, la suscripción debe trasladarse de forma atómica a la cuenta actual o eliminarse antes de crear la nueva, para no avisar al usuario anterior.
- Debe haber baja explícita que elimine la subscription del dispositivo, y la desactivación de un usuario debe eliminar sus subscriptions y entregas pendientes.
- Validar formato y límites de `endpoint`, `p256dh` y `auth`; no registrar claves, endpoints ni payloads en texto de logs.
- El consentimiento debe explicar que el nombre del cliente aparecerá potencialmente en la pantalla bloqueada. El cifrado del transporte no oculta el contenido una vez mostrado por el sistema operativo.

## Recomendaciones para las seis decisiones de producto e infraestructura

1. **Transporte:** recomendar **Web Push con VAPID**. Validarlo primero en Chrome/Android y en un iPhone real con la PWA añadida a Inicio; no prometer soporte push en Safari iOS como pestaña normal.
2. **Horario:** recomendar `09:00 ≤ hora local < 20:00`, todos los días mientras no exista un calendario laboral. Usar la zona IANA del negocio y un cron en minuto `00`, no un `interval` anclado al instante de despliegue.
3. **Pool sin responsable:** recomendar no enviar a nadie salvo a administradores activos que hayan elegido explícitamente recibir alertas de pool. Debe soportar más de un admin.
4. **Marta:** recomendar preferencias separadas: `solo_pool` como opción inicial y `todo_el_negocio` como opt-in explícito. Suscribirse en un dispositivo solo habilita el transporte, no activa automáticamente ambas políticas.
5. **iOS y PWA:** aceptar la limitación y añadir guía contextual, detección de capacidad e iconos PNG 192/512 antes de solicitar permiso. Si el navegador no soporta Push, explicar el motivo sin mostrar un toggle engañoso.
6. **Claves VAPID:** la generación y carga de secretos debe hacerla un operador autorizado. `VAPID_PRIVATE_KEY` y el subject viven solo en variables de entorno de Convex; la clave pública es publicable en Railway. No se deben copiar claves, endpoints ni tokens a actas, drivers, capturas o Git.

## Observaciones no bloqueantes

- Una persona con varias subscriptions recibirá, por diseño, una notificación por dispositivo. El término “una sola vez” debe definirse como un solo evento por ciclo y destinatario, no una sola alerta física entre todos sus dispositivos.
- Indexar solo por `estado` obliga a recorrer todas las pendientes. Para la cola remediada conviene indexar por estado y siguiente instante elegible, y procesar lotes acotados.
- `enums.ts` solo debe recibir valores que el cliente necesite mostrar. Los estados internos de cola pueden permanecer exclusivamente en el schema/servidor para evitar exponer un catálogo innecesario.
- El deep-link no debe llevar ningún secreto. Al abrir `/clientes/[id]`, la autorización de cartera actual debe decidir el acceso; si el cliente cambió de responsable, la interfaz debe manejar el “No encontrado” sin revelar datos.

## Plan mínimo revisado

1. Resolver B-1 a B-4 en una versión v2 de diseño, incluidos modelo de eventos/entregas, preferencias y semántica de reintento.
2. Auditar Fase A con el ciclo de vida de subscriptions y una prueba manual en dispositivo real antes de publicar la UI de permiso ampliamente.
3. Implementar una Fase B interna y restringida a prueba de entrega, con secretos solo en entornos autorizados y sin un endpoint público de envío arbitrario.
4. Solo entonces implementar la detección automática, guard horario, revalidación previa al envío y pruebas de ciclo, reasignación, recordatorio tardío, 404/410 y error transitorio.

## Constancia de auditoría

Esta revisión fue exclusivamente de diseño y lectura de la arquitectura, código local y documentación oficial. No se modificó código de aplicación, configuración, secretos, datos de desarrollo o producción, despliegues, repositorio remoto ni Linear. Esta acta es el único archivo creado por la auditoría.
