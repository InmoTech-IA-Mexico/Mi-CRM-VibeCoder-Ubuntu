# Acta de remediación — JUA-33 Fase C · defecto B-1/B-2 "la reclamación pierde la audiencia"

Fecha: 2026-07-17
Commit candidato: `6a693cc` sobre `4fff2b5` (B-2) → `70e222d` (B-1) → `5826b4b`/`b08d399` (B-3).
**JUA-33 completo NO desplegado** (local + dev de Convex).
Referencia: *Acta de auditoría de avance B-1/B-2 v1* = **NO-GO MANTENIDO** (bloqueante:
"La reclamación pierde la identidad de la audiencia"; + cobertura incompleta; + 2 obs. no bloqueantes).
Veredicto propuesto: **bloqueante remediado; se solicita revisión de la remediación.**

--------------------------------------------------------------------

## El defecto (dictamen v1) — confirmado

En `revalidarDestino`, **toda** fila cuyo cliente tuviera `responsableId` devolvía el responsable actual,
**sin atender la audiencia original ni el rol/preferencia** del destinatario. Con un cliente asignado y
dos filas (responsable por `cartera`; admin por `negocio`), al reclamar: la fila del admin se reasignaba
al responsable → el **responsable recibía duplicado** y el **admin con opt-in "negocio" perdía su alerta**.
Además, el helper **no revalidaba la preferencia vigente**: una fila encolada con `cartera`/`negocio`/`pool`
se enviaba aunque el usuario hubiera pasado a `ninguna`. Incumplía la política vigente de B-1 y el opt-in
persistente de B-2. **Reproducido y confirmado en código antes de remediar.**

## La remediación (`6a693cc`) — exactamente la vía indicada por el auditor

**1) Fuente ÚNICA de verdad de la preferencia efectiva.** `inactividad.prefFrioEfectiva(rol, pref)` /
`prefFrio(usuario)` — usada por el **encolado** (`clientes`) y por la **revalidación** (`notificaciones`).
El defecto nacía de que ambas rutas no coincidían; ahora comparten la misma regla. (Corrige de paso el
default del **observador → `ninguna`**, obs. no bloqueante 2.)

**2) Audiencia MATERIALIZADA por fila.** Nuevo `notificacionesPush.audiencia`:
`responsable` | `admin_negocio` | `admin_pool`, fijada al encolar. Un usuario que califique por varias
vías queda con la **más estable**: si un admin es a la vez responsable y tiene `negocio`, prevalece
`admin_negocio` (su alerta no depende de seguir siendo responsable). Campo **opcional** → filas de dev
previas se descartan como `sin_audiencia`.

**3) Revalidación POR audiencia** (misma mutación transaccional que reclama):
- `responsable`: destino = responsable **actual** del cliente (redirige si se reasignó), solo si está
  **activo** y su pref incluye su cartera (`cartera`/`negocio`); si el cliente pasó al pool → `sin_responsable`;
  inactivo → `responsable_inactivo`; pref excluyente → `excluido_por_preferencia`.
- `admin_negocio`: el admin **ORIGINAL** (`n.usuarioId`), **nunca** se redirige; solo si sigue **activo**,
  **admin** y con `negocio`. Si no → descartada.
- `admin_pool`: el admin **ORIGINAL**, solo si el cliente **sigue sin asignar**, el admin activo y con `pool`.
- El guard de **recordatorio próximo** se conserva y aplica a todas las audiencias.

## Evidencia dinámica — driver-36 (7/7), mapeada a los 5 escenarios exigidos

Reporte: `tmp/drivers-jua33/reporte-B1B2-audiencia-dev.txt`. Estados por `qaListarNotifs` (ahora expone
`audiencia`) y reclamos reales de `reclamarLote`; datos demo restaurados; sin secretos.

| Exigido por el auditor | Prueba | Resultado |
|---|---|---|
| 1. Responsable `cartera` + admin `negocio` → dos filas a usuarios distintos | **T1** | reclaman a Carlos **y** Marta (audiencias `responsable`/`admin_negocio`) |
| 2. Admin `negocio` → `ninguna` tras encolar: descarta, no redirige | **T2** | fila de Marta `descartada/excluido_por_preferencia`; **Carlos no se duplica** |
| 3. Reasignación: responsable anterior se redirige; admin_negocio permanece admin | **T3** | reclaman **Vendedor Dos** (redirigido) **y** Marta; Carlos ausente |
| 4. Admin `pool` con cliente que recibe responsable / pasa a `ninguna`: descarta | **T4a/T4b** | `destinatario_no_corresponde` / `excluido_por_preferencia` |
| 5. Responsable inactivo **y** pool sin admin válido, **dinámicos** | **T5a/T5b** | `responsable_inactivo` / `destinatario_no_corresponde` (estado volteado en vivo) |

> Sobre la cobertura incompleta señalada: los ramos de **inactivo** ya **no** son "cubiertos por código",
> se ejecutan dinámicamente (T5a/T5b) volteando el `estado` con un helper QA reversible que **no** toca
> sesiones ni credenciales (a diferencia de `usuarios.desactivar`/`reactivar`).

## Observaciones no bloqueantes del dictamen — atendidas

- **Default del observador:** `miPreferenciaFrio` ahora deriva `ninguna` para el observador (vía la fuente
  única `prefFrioEfectiva`).
- **Helpers QA en el bundle:** siguen gated por `QA_HELPERS` (inertes en prod). Se añade `qaSetEstadoUsuario`
  (dev). **Checklist de despliegue:** verificar con `npx convex env get QA_HELPERS` en **prod** que la
  variable **no existe** antes de `deploy`, y que ninguna ruta de aplicación los invoca (son `internal*`).

## Verificación estática (0 errores)

```txt
npx tsc --noEmit   OK        npm run build          OK (25 rutas)
npx eslint         OK        npx convex dev --once  OK (campo audiencia + helpers)
```

## Estado consolidado

| Bloqueante | Estado |
|---|---|
| B-1 — Revalidación de destino (recordatorio + destinatario/política vigente) | **Cerrado** (con `6a693cc`) |
| B-2 — Preferencias opt-in (modelo, encolado y **reclamación** respetan la pref vigente) | **Cerrado** (con `6a693cc`) |
| B-3 — Cola durable | Cerrado |
| B-4 — Entrega automática / deep-link | Pendiente (prueba real; se retomará tras el visto bueno de B-1/B-2) |

## Constancia

Cambios solo en dev de Convex + repo local; **sin despliegue**, sin tocar prod, remoto ni Linear. El único
archivo creado por esta remediación es esta acta y el reporte del driver-36.
