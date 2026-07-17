# Acta de auditoría — Alerta push de cliente frío (JUA-33) · Fases A+B · v1

Fecha: 2026-07-16  
Commits auditados: `64fb26d` + `565c5d6` + `5956a9f`  
Base productiva: `2136a30`  
Estado revisado: candidato local; no desplegado por esta auditoría  
Referencia: dictamen de diseño JUA-33 v1 = **NO-GO** para el flujo automático  
Veredicto: **NO-GO DE CHECKPOINT A+B**

---

## Resultado

La separación entre una mutación/consulta Convex y una acción Node con `web-push` es técnicamente correcta. El delta no contiene secreto VAPID y el emisor de prueba está restringido al usuario de la sesión.

No se autoriza continuar el checkpoint A+B como cerrado ni usarlo como base de despliegue. Dos controles de ciclo de vida exigidos por el dictamen de diseño siguen ausentes, y la interfaz de prueba comunica un resultado falso cuando el envío falla. Deben corregirse antes de pasar a Fase C.

Fase C y D no fueron revisadas porque aún no forman parte del candidato.

## Integridad y comprobaciones locales

- La serie es lineal: `64fb26d` parte de `2136a30`, `565c5d6` parte de `64fb26d` y `5956a9f` parte de `565c5d6`.
- El delta contiene nueve archivos: tabla aditiva, mutaciones/consultas, acción Node, Service Worker, interfaz de perfil, dependencia `web-push`, lockfile y API generada.
- `git diff --check 2136a30..5956a9f` y `node --check public/sw.js` no reportaron errores.
- `npx tsc --noEmit` y `npx eslint .` finalizaron correctamente. `npm run build` compiló las 25 rutas tras repetirse fuera del sandbox; el primer intento solo falló al descargar las fuentes Google de Next.js.
- `.env.local` está ignorado. La revisión de Git solo encontró nombres de variables VAPID, no valores de claves.
- No se ejecutaron mutaciones, acciones, drivers ni pruebas contra Convex; no se alteraron datos, secretos, despliegues, Git remoto ni Linear desde esta auditoría.

## Aspectos correctos

- `guardarSubscription` deriva `usuarioId` y `negocioId` de una sesión válida, sin aceptar esos identificadores desde el cliente. `borrarSubscription` limita la baja a la suscripción del propio usuario.
- El emisor usa un archivo separado con `"use node"` y accede a Convex mediante `runQuery` y `runMutation`, no mediante `ctx.db`. Esa frontera es la adecuada para una librería Node. [Documentación de actions de Convex](https://docs.convex.dev/functions/actions)
- `enviarPrueba` resuelve la sesión internamente y solo consulta las subscriptions del propio usuario. No hay una acción pública que acepte un `usuarioId` arbitrario.
- El Service Worker usa `event.waitUntil` para mostrar una notificación visible y gestiona `notificationclick`. El permiso se solicita al pulsar el control, coherente con el requisito de gesto de usuario de Apple. [Documentación de Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- Las respuestas 404/410 se distinguen de errores transitorios, una base correcta para el protocolo de reintento que deberá llegar en Fase C.

## Bloqueantes

### B-1 — Una subscription existente no se reasocia al cambiar de cuenta

El backend permite reasignar un endpoint mediante `guardarSubscription`, pero la interfaz no lo invoca si ya existe una subscription local. Al montar la tarjeta, `getSubscription()` marca el control como activo; el usuario nuevo no puede activar para ejecutar el upsert y, si lo desactiva, `borrarSubscription` no elimina la fila porque pertenece al usuario anterior. Después se desuscribe localmente y la fila del usuario anterior puede permanecer en Convex hasta una respuesta 404/410 futura.

Esto incumple el control de diseño que exigía trasladar o eliminar de forma atómica la subscription cuando un mismo perfil de navegador cambia de cuenta.

**Remediación requerida:** con una subscription existente y una sesión válida, sincronizar sus endpoint/claves con `guardarSubscription` antes de mostrarla como activa, o comprobar y reparar explícitamente la asociación en servidor. La baja debe dejar coherentes navegador y fila remota incluso ante cambio de cuenta o error parcial.

### B-2 — Revocar un usuario no borra sus subscriptions

La tabla nueva no está integrada con `usuarios.desactivar`. Esa mutación solo desactiva al usuario y elimina sesiones; no borra las filas de `pushSubscriptions` indexadas por usuario. El propio dictamen de diseño requería borrar subscriptions y entregas pendientes al revocar una cuenta.

Aunque Fase C deberá filtrar destinatarios activos, conservar endpoints y claves de una cuenta revocada es una retención innecesaria y deja una defensa esencial incompleta.

**Remediación requerida:** en la ruta de desactivación, eliminar todas las subscriptions del usuario en la misma mutación; Fase C deberá además descartar entregas pendientes al quedar inactivo el destinatario.

### B-3 — La prueba muestra “no hay dispositivos” cuando sí existen pero el envío falla

`enviarPrueba` devuelve `{ total, enviadas, caducadas, fallidas }`, pero la interfaz solo trata `enviadas > 0` como existencia de dispositivo. Para el caso declarado por el acta —una subscription fake, `total: 1, fallidas: 1`— muestra “No hay dispositivos suscritos ahora mismo”, que es falso y oculta el error de entrega. El mismo problema aparece en una entrega parcial.

La prueba de Fase B es la única vía visible para validar el transporte antes de automatizar; su resultado debe distinguir falta de subscriptions, éxito total/parcial y fallo sin revelar endpoints ni detalles sensibles del proveedor.

**Remediación requerida:** basar el mensaje de ausencia en `total === 0` y presentar un estado de fallo o parcial cuando corresponda. Añadir una aserción UI para este caso antes de declarar cerrada la Fase B.

## Observaciones no bloqueantes

### OBS-1 — Borrado de caducadas con carrera de reasignación

`subsDeUsuario` devuelve endpoint y claves, y `borrarPorEndpoint` borra por endpoint sin verificar que la fila aún pertenece al usuario/clave leída por la acción. Si el endpoint se reasigna entre lectura y una respuesta 404/410, la acción vieja podría borrar la subscription ya actualizada del nuevo usuario.

Conviene devolver el ID de subscription y borrar condicionalmente solo si el documento conserva el mismo usuario y/o versión material leída. Esto es especialmente relevante al corregir B-1.

### OBS-2 — Validación y límite de subscriptions

Las mutaciones admiten strings sin límite ni validación estructural. Antes de exponer ampliamente el toggle, validar `endpoint` HTTPS, codificación/tamaño razonable de las claves y fijar un máximo de dispositivos por usuario. Además, limitar en servidor la frecuencia de `enviarPrueba` para impedir spam o consumo externo desde una sesión comprometida.

### OBS-3 — Configuración ausente se presenta como navegador no compatible

La detección usa la ausencia de `NEXT_PUBLIC_VAPID_PUBLIC_KEY` como `soportado = false`. Si Railway no tiene la variable de build, un navegador compatible verá el aviso de incompatibilidad en lugar de un estado de configuración no disponible. Diferenciar ambos casos facilita diagnosticar un despliegue incompleto.

### OBS-4 — Evidencia y experiencia PWA pendientes

No se localizó un driver ni reporte durable de las invocaciones dev declaradas; el acta candidata es el único registro disponible. Tampoco se añadieron los iconos PWA 192/512 previstos en el diseño de Fase A; el manifest continúa con solo `favicon.ico`. No bloquean la corrección de B-1 a B-3, pero la evidencia de la prueba real y los iconos deben estar antes de publicar el permiso en producción.

## Condiciones para levantar el NO-GO

1. Corregir y probar el traslado/eliminación de una subscription al cambiar de usuario en el mismo navegador.
2. Integrar la limpieza de subscriptions en `usuarios.desactivar` y ejercerla con una negativa/positiva de servidor.
3. Corregir el resultado de prueba para los casos `total = 0`, fallo total y envío parcial; cubrirlo en UI.
4. Conservar un reporte sanitizado de las pruebas de servidor y, antes de cualquier despliegue, realizar la prueba real en al menos un dispositivo compatible.
5. Mantener Fase C separada hasta que el modelo de evento/entrega, preferencias y semántica de reintentos del dictamen de diseño estén materializados.

## Constancia de auditoría

La revisión fue de solo lectura sobre Git, código local, configuración ignorada y documentación oficial. No se modificó código de aplicación, datos de desarrollo o producción, secretos, despliegues, repositorio remoto ni Linear. Esta acta es el único archivo creado por la auditoría.
