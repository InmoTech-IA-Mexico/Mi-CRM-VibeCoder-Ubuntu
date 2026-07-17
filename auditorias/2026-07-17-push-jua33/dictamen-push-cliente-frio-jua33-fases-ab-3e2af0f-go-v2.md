# Acta de auditoría — Alerta push de cliente frío (JUA-33) · Fases A+B · v2

Fecha: 2026-07-16  
Commits auditados: `64fb26d` + `565c5d6` + `5956a9f` + `3e2af0f`  
Base productiva: `2136a30`  
Estado revisado: candidato local; no desplegado por esta auditoría  
Referencia: dictamen A+B v1 = **NO-GO** por B-1, B-2 y B-3  
Veredicto: **GO DE CHECKPOINT A+B CON OBSERVACIONES NO BLOQUEANTES — SIN AUTORIZACIÓN DE DESPLIEGUE**

---

## Resultado

Se levanta el NO-GO del checkpoint A+B. `3e2af0f` corrige los tres bloqueantes en código y no altera el diseño separado de Fase C/D.

Este GO autoriza continuar la construcción y revisión de Fase C. No autoriza desplegar A+B ni declarar JUA-33 listo: falta el flujo automático completo y la prueba de recepción real en dispositivo con las variables VAPID del entorno objetivo.

## Integridad y comprobaciones locales

- `3e2af0f` es hijo directo de `5956a9f`.
- El delta de remediación contiene nueve archivos: cambios en `push`, `pushEnvio`, `usuarios`, tarjeta de perfil, Service Worker, manifest e iconos PWA.
- `git diff --check 5956a9f..3e2af0f` no reportó errores.
- Los iconos nuevos son PNG válidos de 192×192 y 512×512; el manifest declara los iconos estándar y maskable, y el Service Worker usa el de 192 como icono/badge por defecto.
- `npx tsc --noEmit` y `npx eslint .` finalizaron correctamente. `npm run build` compiló las 25 rutas después de repetirse fuera del sandbox: el primer intento solo quedó bloqueado al descargar fuentes Google de Next.js.
- No se ejecutaron drivers ni mutaciones de Convex, no se alteraron datos, secretos, despliegues, Git remoto ni Linear desde esta auditoría.

## Revisión de los bloqueantes v1

### B-1 — Cambio de cuenta con subscription local

**Estado: RESUELTO.**

Al cargar Perfil, si hay una PushSubscription local con claves, la tarjeta llama `guardarSubscription` con la sesión actual antes de declararla activa. El upsert sigue asociando usuario y negocio exclusivamente desde el token de sesión. Así, el endpoint pasa al usuario nuevo sin depender de pulsar el toggle.

La prueba de servidor cubre el traspaso de Carlos a un segundo operativo, la pérdida de control del dueño anterior y la baja por el nuevo dueño. La parte de montaje del perfil fue revisada estáticamente; la prueba de navegador real sigue pendiente antes de desplegar.

### B-2 — Revocación de cuenta

**Estado: RESUELTO.**

`usuarios.desactivar` borra, en la misma mutación que deja inactivo al usuario y elimina sus sesiones, todas las filas de `pushSubscriptions` indexadas por `usuarioId`. Con ello no se conservan endpoints ni claves de cuentas revocadas.

El driver crea una cuenta QA, registra una subscription y la desactiva. El código de limpieza cumple la condición; la comprobación final de cero filas se declara realizada por consulta externa, pero su transcripción no quedó incluida en el reporte (ver OBS-3).

### B-3 — Resultado de la prueba de entrega

**Estado: RESUELTO.**

La tarjeta ahora separa correctamente:

- `total === 0`: no hay dispositivos suscritos.
- Todas las entregas: éxito.
- Una parte: entrega parcial.
- Ninguna entrega con dispositivos existentes: fallo de entrega.

Por tanto, el resultado `{ total: 1, enviadas: 0, fallidas: 1 }` ya no se presenta como ausencia de dispositivos. El driver confirma que la acción devuelve ese caso; la aserción visual requiere la prueba real pendiente.

## Revisión de observaciones v1

- **Carrera entre lectura y 404/410:** `borrarPorEndpoint` recibe el `usuarioId` que leyó la acción y solo borra si la fila continúa perteneciendo a ese usuario. Evita que una respuesta tardía elimine la subscription de otro usuario tras reasignación.
- **Configuración y PWA:** la interfaz diferencia un navegador sin soporte de un entorno sin la clave pública VAPID; se añadieron iconos PWA estándar y maskable.
- **Límites:** existen longitud máxima y tope de dispositivos, una mejora efectiva frente a la ausencia anterior.

## Observaciones no bloqueantes

### OBS-1 — Validación y tope aún pueden endurecerse

La comprobación del endpoint es `startsWith("https://")`; no valida una URL bien formada ni las claves como base64url. Además, el tope de 20 se aplica al insertar una fila nueva, pero no cuando un endpoint ajeno se reasigna a un usuario que ya tenía 20 devices.

Conviene usar `new URL`, exigir `https:`, validar el alfabeto/tamaño de claves y aplicar el tope después de cualquier reasignación. Es un endurecimiento de abuso y calidad, no una exposición actual de otros usuarios.

### OBS-2 — Carrera residual al renovar claves del mismo usuario

El borrado condicional usa usuario y endpoint, no una versión o ID de la fila. Una respuesta 404/410 de una lectura vieja podría borrar una fila del mismo usuario cuyos `p256dh`/`auth` se hubieran renovado mientras se esperaba la respuesta. Para Fase C, devolver el ID de subscription y borrar condicionalmente contra ese ID/versión elimina también ese caso.

### OBS-3 — Precisión de la evidencia del driver

El reporte preservado declara 11 PASS, pero la comprobación post-desactivación de “0 subscriptions” no está en sus líneas PASS: el propio driver la delega a una consulta MCP externa y solo deja el ID QA para verificar. La afirmación de esa consulta debe conservar su transcripción sanitizada o el driver debe registrar el resultado como aserción propia.

Asimismo, los tres logins iniciales ocurren antes de `try/finally`; si uno posterior fallara, podría quedar una sesión de prueba. Es una mejora de limpieza de evidencia.

### OBS-4 — Prueba real y límites de la interfaz

No hay todavía prueba real de recepción, clic o mensaje visual en un dispositivo compatible. Tampoco debe considerarse probado el flujo de cambio de cuenta en navegador solo por la prueba de servidor. Antes de desplegar, verificar en un navegador real la sincronización al entrar con otra cuenta y los cuatro mensajes de resultado de prueba, sin exponer valores VAPID en evidencias.

## Condiciones antes de cualquier despliegue

1. Completar y auditar Fase C/D conforme al dictamen de diseño: eventos/entregas por destinatario, preferencias, ciclo de inactividad, revalidación previa y protocolo de reintentos.
2. Ejecutar la prueba real de recepción y deep-link en dispositivo compatible, con la PWA instalada en iOS cuando aplique.
3. Cargar claves VAPID únicamente en los entornos autorizados, verificar contra producción que Convex y Railway las consumen y no preservarlas en repo, drivers, capturas o actas.
4. Archivar reportes y capturas sanitizados fuera de `tmp/` al cierre productivo.

## Constancia de auditoría

La revisión fue de solo lectura sobre Git, código, reportes y activos locales. No se modificó código de aplicación, datos de desarrollo o producción, secretos, despliegues, repositorio remoto ni Linear. Esta acta es el único archivo creado por la auditoría.
