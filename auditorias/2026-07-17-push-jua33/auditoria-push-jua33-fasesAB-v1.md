# Acta para revisión — Alerta push de cliente frío (JUA-33) · Fases A+B · v1

Fecha: 2026-07-16
Commits candidatos: `64fb26d` (Fase A) + `565c5d6` (Fase B) + `5956a9f` (tipos generados)
Base productiva actual: `2136a30`
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Diseño de referencia: `tmp/diseno-jua33-push-cliente-frio.md`
Veredicto: **PENDIENTE DE DICTAMEN (revisión de Fases A+B; Fase C/D por construir)**

--------------------------------------------------------------------

## Alcance de esta entrega

Feature multi-fase. Aquí se entregan las **Fases A (suscripción) y B (emisor)**. Falta la **C
(disparo automático al pasar a Inactivo + cron con guard de horario)** y la **D (deep-link + pruebas
finales)**. Se pide revisión del checkpoint A+B antes de continuar.

Decisiones adoptadas (del §6 del diseño, aprobadas con "procede"): **Web Push (VAPID)** como
transporte; horario diurno **9:00–20:00** (se aplicará en Fase C); pool → admin (Fase C); Marta
opt-in; **iOS solo con PWA instalado** (guía en UI); claves VAPID generadas por mí, la privada solo en
entorno.

--------------------------------------------------------------------

## Fase A — Suscripción (`64fb26d`)

- **Esquema:** tabla `pushSubscriptions` (`endpoint` único + claves `p256dh`/`auth`, `usuarioId`,
  `negocioId`), índices `por_endpoint` y `por_usuario`. Campo nuevo, sin migración.
- **Backend `convex/push.ts`:** `guardarSubscription` (upsert por endpoint; reasigna al usuario de la
  sesión) y `borrarSubscription` (solo la propia). Ambas exigen sesión válida.
- **Service worker `public/sw.js`:** sin caché/offline; maneja `push` (muestra la notificación) y
  `notificationclick` (enfoca o abre la ficha del cliente vía la `url` del payload).
- **UI `/perfil`:** tarjeta "Notificaciones" con toggle que pide permiso y suscribe/desuscribe **este
  dispositivo**; detecta soporte y guía en iOS ("agrega la app a inicio"); gestiona permiso denegado.
  La clave pública VAPID llega por `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

## Fase B — Emisor + prueba real (`565c5d6`)

- **`convex/pushEnvio.ts`** (`"use node"`): firma con VAPID (claves del entorno de Convex) y envía por
  `web-push` a cada suscripción del usuario; **404/410 → borra** la suscripción caducada, el resto
  cuenta como fallo transitorio (no la borra). Tipos de retorno **explícitos** para evitar la
  inferencia circular que degradaba la API generada.
- **Internos** en `push.ts`: `usuarioDeSesion`, `subsDeUsuario`, `borrarPorEndpoint`.
- **`enviarPrueba`** (action autorizada): envía una notificación de prueba a los propios dispositivos
  del usuario — valida la entrega **de extremo a extremo** antes de automatizar. No toca a otros.
- **UI:** botón "Enviar notificación de prueba" en `/perfil` cuando el aviso está activo.
- **Dependencia** `web-push` (+ `@types/web-push`). Tipos generados (`_generated`) commiteados en
  `5956a9f` para que el build de Railway encuentre `api.push`/`api.pushEnvio`.

--------------------------------------------------------------------

## Seguridad / notas

- **La clave privada VAPID NUNCA se commitea** (repo público): vive solo en `.env.local` (gitignored,
  verificado con `git check-ignore`) y en el entorno de Convex (`npx convex env set`). La pública sí
  viaja al cliente (es su naturaleza).
- **Autorización:** las mutaciones de suscripción y la action `enviarPrueba` exigen sesión válida;
  `borrarSubscription` solo borra la del propio usuario; `enviarPrueba` solo envía a los dispositivos
  del propio usuario. Sin nueva superficie que exponga datos de otros.
- **Alcance de datos:** una suscripción no contiene datos del CRM; es un endpoint del navegador + claves.

## Verificación (0 errores)

```txt
npx tsc --noEmit   OK      npm run build   OK
npx eslint         OK      npx convex dev --once  OK
```

**Backend (dev, vía `npx convex run`):**
- Suscripción: `guardar` → id; `upsert` mismo endpoint → mismo id; token inválido → "No autorizado";
  `borrar` → ok. `/sw.js` servido (200, `application/javascript`).
- Emisor: `enviarPrueba` sin subs → `{total:0}`; con 1 fake → `{total:1, fallidas:1}` (endpoint FCM
  inválido, no 404/410 → no se borra, correcto); token inválido → "No autorizado".

**Pendiente — entrega real en dispositivo (la "prueba manual" del diseño):** que *aparezca* una
notificación requiere una suscripción de navegador real. Se validará con el toggle + botón "Enviar
prueba" en un navegador real (reiniciando `npm run dev` para cargar la clave pública, o tras desplegar
con el env de prod). Opcionalmente, un driver Playwright headless (más frágil por el push service).

--------------------------------------------------------------------

## Decisiones para tu revisión

- **Transporte Web Push** (no FCM/APNs): sin SDKs propietarios; iOS solo con PWA instalado (documentado).
- **Suscripción por dispositivo** (endpoint), no por usuario: un usuario puede tener varios dispositivos.
- **Botón de prueba en /perfil**: es la vía honesta de validar la entrega real antes de automatizar; se
  puede ocultar o quitar tras la Fase C si se prefiere.
- **Fase A sola no tiene valor visible** (toggle que aún no dispara nada): se recomienda **no desplegar
  hasta al menos tener la prueba de entrega real** (y probablemente hasta Fase C).

## Requisito para el despliegue (cuando toque)

Cargar en prod: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en **Railway** (build) y
`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` en **Convex prod** (`npx convex env set --prod`).

## Siguiente paso

Con tu visto bueno del checkpoint A+B: **Fase C** — cola `notificacionesPush`, encolar al pasar a
Inactivo en `transicionarClientes`, cron `flush` con guard de horario por zona horaria y dedup; luego
la prueba de entrega real y Fase D.
