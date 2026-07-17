# Diseño — Alerta push de cliente frío (JUA-33)

Fecha: 2026-07-16 · Estado: **propuesta de diseño (sin código)** · Prioridad: High
Proyecto: "Resto del PRD" · Milestone: "Fase 1 — Notificaciones push"

--------------------------------------------------------------------

## 1. Objetivo (del PRD / issue)

Avisar por **notificación push** al usuario responsable cuando un cliente se enfría — pasa a
**Inactivo** (15 días sin interacción real, en Prospecto/Activo, sin recordatorio en los próximos
3 días) — **aunque la app esté cerrada**.

- Contenido: `⚠️ [Nombre del cliente] lleva 15 días sin contacto`.
- Tocarla → abre la **Ficha del cliente**.
- **Una sola vez** al cumplirse los 15 días (no cada día).
- **No** se envía si ya hay recordatorio en los próximos 3 días.
- Receptores: **Carlos** (los de su cartera); **Marta** opcional.
- Requisitos: permiso explícito del usuario · **respetar zona horaria del negocio** (no de noche).

--------------------------------------------------------------------

## 2. Elección de transporte: **Web Push (VAPID)**

La app ya es un **PWA instalable**. El estándar para PWAs es **Web Push** (Push API + Service Worker
+ claves **VAPID**), que evita SDKs propietarios (FCM/APNs) y sirve a todas las plataformas relevantes:

| Plataforma | Web Push |
|---|---|
| Android (Chrome/Firefox/Edge) | ✅ incluso sin instalar |
| Escritorio (Chrome/Firefox/Edge) | ✅ |
| **iOS/iPadOS 16.4+** | ✅ **solo si el PWA está "Agregado a inicio"** (instalado); no en pestaña de Safari |

Encaja con nuestro stack (Next PWA + Convex) sin cuentas de Google/Apple ni SDKs nativos. El issue
menciona "FCM/APNs **o equivalente web**" — Web Push **es** ese equivalente y es la opción correcta aquí.

**Limitación a aceptar:** en iPhone/iPad el usuario debe **instalar el PWA** (Compartir → Agregar a
inicio) para recibir push. Se documenta y se guía en la UI.

--------------------------------------------------------------------

## 3. Arquitectura (componentes)

```
[Navegador/PWA]                         [Convex]                         [Push Service del navegador]
  Service Worker (public/sw.js)                                          (FCM/Mozilla/WNS, transparente)
   • push → showNotification            crons.daily transicionar-inactivos
   • notificationclick → abrir ficha       └─ transicionarClientes()  ── al pasar a Inactivo ──▶ ENQUEUE
  Cliente web                                                              en tabla notificacionesPush
   • pedir permiso + subscribe          crons  flush-notificaciones-push (cada hora)
   • guarda subscription  ───────────▶     └─ por cada pendiente, si es horario diurno en la tz del
   • /perfil: toggle on/off                    negocio → action Node (web-push) firma con VAPID y envía
                                               └─ 410/404 (caducada) → borra la subscription
```

**Piezas nuevas:**

1. **Service Worker** `public/sw.js` (mínimo, sin caché/offline — ya tenemos banner sin conexión):
   maneja `push` (muestra la notificación con título/cuerpo/URL) y `notificationclick`
   (enfoca o abre `/clientes/[id]`). Registrado desde el cliente al activar notificaciones.

2. **Suscripción push** (cliente): pedir `Notification.requestPermission()`, luego
   `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <VAPID pública> })`,
   y **guardar la subscription** (endpoint + claves p256dh/auth) en Convex vía una mutation.

3. **Tabla `pushSubscriptions`** (ver §4): una fila por dispositivo/usuario.

4. **Tabla `notificacionesPush`** (cola, ver §4): desacopla *detección* (mutation) de *envío* (action
   Node), y permite el **guard de horario** y el **dedup**.

5. **Enganche de detección**: en `transicionarClientes` (la usa el cron diario y la sync por negocio),
   al hacer `patch(estado:"inactivo")` se **encola** una notificación para el `responsableId` del
   cliente (y, si no tiene, para el/los admin — decisión §6).

6. **Emisor** `convex/push.ts` con `"use node"` + librería **`web-push`**: firma VAPID y hace el POST
   al endpoint de cada subscription. (Alternativa sin Node: firmar VAPID + cifrar payload con Web
   Crypto en el runtime V8 de Convex; más código, se evita usando la action Node.)

7. **Cron `flush-notificaciones-push`** (cada hora): recorre pendientes; para cada una, si en la **tz
   del negocio** es horario diurno (p.ej. 9:00–20:00) la envía y la marca `enviada`; si no, la deja
   para la siguiente pasada. Esto respeta la zona horaria y agrupa envíos.

--------------------------------------------------------------------

## 4. Modelo de datos (añadidos a `schema.ts` + `enums.ts`)

```ts
pushSubscriptions: defineTable({
  usuarioId: v.id("usuarios"),
  negocioId: v.id("negocios"),
  endpoint: v.string(),            // URL única del push service (identidad de la subscription)
  p256dh: v.string(), auth: v.string(),  // claves de cifrado del navegador
  creadoEn: v.number(),
  ultimoOkEn: v.optional(v.number()),
}).index("por_usuario", ["usuarioId"]).index("por_endpoint", ["endpoint"]),

notificacionesPush: defineTable({
  negocioId: v.id("negocios"),
  usuarioId: v.id("usuarios"),     // destinatario
  clienteId: v.id("clientes"),
  tipo: v.literal("cliente_frio"), // extensible a otros tipos a futuro
  estado: v.union(v.literal("pendiente"), v.literal("enviada"), v.literal("descartada")),
  creadoEn: v.number(),
  enviadaEn: v.optional(v.number()),
}).index("por_estado", ["estado"]).index("por_cliente_tipo", ["clienteId", "tipo"]),
```

Dedup/una-sola-vez: la transición a Inactivo ocurre **una vez** (la regla exige estado Prospecto/Activo;
un cliente ya Inactivo no vuelve a transicionar). Además, antes de encolar se comprueba que no exista
ya una `notificacionesPush` de ese `clienteId`+`tipo` en estado pendiente/enviada reciente.

--------------------------------------------------------------------

## 5. Flujo de envío (paso a paso)

1. El cron diario `transicionar-inactivos` (o la sync al abrir Inicio) llama `transicionarClientes`.
2. Un cliente cumple `debeMarcarseInactivo` → `patch(estado:"inactivo")` → **encola** `notificacionesPush`
   `{usuarioId: responsable, clienteId, tipo:"cliente_frio", estado:"pendiente"}` (si no hay una previa).
3. El cron `flush-notificaciones-push` (cada hora) toma las pendientes. Para cada una:
   - Carga el negocio → `zonaHoraria`; si **no** es horario diurno local, la deja pendiente.
   - Si es diurno: lee las `pushSubscriptions` del `usuarioId`; llama la **action Node** que, con
     `web-push` + VAPID, envía a cada endpoint el payload `{titulo, cuerpo, url:/clientes/[id]}`.
   - Respuestas `410/404` (subscription caducada) → borra esa fila de `pushSubscriptions`.
   - Marca la notificación `enviada`.
4. El **Service Worker** recibe el `push`, muestra la notificación; al tocarla, `notificationclick`
   abre/enfoca `/clientes/[id]`.

--------------------------------------------------------------------

## 6. Decisiones que necesito de ti (producto/infra)

1. **Transporte:** ¿confirmas **Web Push (VAPID)** (recomendado) frente a FCM/APNs? (Web Push evita
   cuentas y SDKs propietarios y cubre Android/escritorio/iOS-instalado.)
2. **Horario diurno del negocio** para el guard: propongo **9:00–20:00** hora local del negocio. ¿Ok?
3. **Clientes sin responsable (pool):** ¿la alerta va al **admin**, a nadie, o configurable? (Propuesta:
   al admin.)
4. **Marta (admin):** ¿recibe alertas de **qué**? No tiene cartera. Propuesta: recibe las del **pool**
   (sin responsable) y, si lo activa, un modo "todas las del negocio". Por defecto **opt-in** (solo si
   se suscribe).
5. **iOS:** ¿aceptamos la limitación de "solo PWA instalado" y añadimos guía en la UI + íconos PWA
   adecuados (192/512, hoy solo hay favicon)?
6. **Provisión de claves VAPID:** las genero yo (`web-push generate-vapid-keys`); tú cargas
   `VAPID_PRIVATE_KEY` (+ subject mailto) en **Convex** y `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en **Railway**.
   ¿De acuerdo?

--------------------------------------------------------------------

## 7. Entrega por fases (incremental, validando lo más arriesgado primero)

- **Fase A — PWA + suscripción:** íconos PWA + registro del Service Worker; tabla `pushSubscriptions`;
  toggle "Notificaciones push" en `/perfil` (permiso + subscribe/unsubscribe). *Entregable auditable.*
- **Fase B — Emisor + prueba manual:** action Node con `web-push`+VAPID y un botón/oculto de "enviar
  notificación de prueba" para validar **end-to-end** el push real antes de automatizar. *Aquí se
  prueba lo difícil.*
- **Fase C — Disparo automático:** tabla `notificacionesPush`, encolar en `transicionarClientes`, cron
  `flush` con guard de horario y dedup.
- **Fase D — Deep-link + pruebas:** `notificationclick` → `/clientes/[id]`; drivers de servidor (encolado,
  dedup, guard de horario) y prueba viva de recepción.

Cada fase se audita/despliega por separado (evita el ciclo largo y aísla riesgo).

--------------------------------------------------------------------

## 8. Riesgos y limitaciones

- **iOS solo PWA instalado** (documentado). Sin instalar, no hay push en iPhone.
- **Permiso denegado**: si el usuario rechaza, no hay push; la app sigue funcionando (el panel de
  inactividad del MVP no depende de esto).
- **Entrega no garantizada** (los push services no dan garantía de entrega ni orden); el panel de
  inactividad in-app sigue siendo la fuente de verdad.
- **Cron cada hora**: coste bajo en Convex; el guard de horario evita envíos nocturnos por tz.
- **`web-push` en action Node**: dependencia nueva; confirmar que compila en el runtime Node de Convex
  (alternativa Web Crypto documentada si hiciera falta).
- **Multi-negocio/tz**: el diseño ya calcula el horario por `negocio.zonaHoraria`, no por el servidor.

## 9. Plan de pruebas

- **Servidor (drivers):** encolado al transicionar (una vez), dedup (no re-encola), exclusión por
  recordatorio próximo, guard de horario (pendiente fuera de horario / enviada dentro), borrado de
  subscription caducada (simulado).
- **En vivo:** suscribir un dispositivo real, forzar un cliente frío (fixture antedatado por mutación
  interna de QA), verificar recepción y deep-link; revocar QA.

## 10. Estimación aproximada

Fase A ~ pequeña-media · Fase B ~ media (lo más incierto: entrega real) · Fase C ~ media · Fase D ~
pequeña. En total, **varias sesiones**; por eso la entrega por fases con auditoría/despliegue por fase.

--------------------------------------------------------------------

**Siguiente paso sugerido:** que respondas las **6 decisiones de §6**; con eso arranco la **Fase A**
(en rama, para no acoplar con el deploy pendiente de JUA-126).
