# Acta de auditoría — Alta automatizada de negocio (JUA-41) · v1

Fecha: 2026-07-17
Commit candidato: `94342f9` sobre `a99952f` (base productiva `6a693cc`).
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Enfoque acordado: **Opción B (CLI vía `internalMutation`)**, no el backoffice web (Opción A).

--------------------------------------------------------------------

## Qué resuelve

En el MVP, dar de alta un negocio exige que el equipo técnico **inserte el registro `negocios` a mano en la
BD** y cree la invitación del primer admin. JUA-41 lo automatiza **sin acceso directo a la BD**.

## Por qué Opción B (CLI) y no backoffice web

- El "equipo técnico" es una sola persona; un `/admin` con **autenticación separada** añade una superficie
  **pública** para el privilegio máximo (crear negocios y su primer admin). La CLI **no expone endpoint**.
- Reutiliza el patrón existente: `seed.ts` ya son `internalMutation` corridas con `npx convex run` +
  credenciales de deploy.
- El propio issue prevé que, con el registro público autoservicio (**JUA-39**), esta tarea quede como
  "gestión de emergencia/soporte" → una CLI ligera es lo idóneo.

## Cambios (`convex/negocios.ts`, módulo nuevo)

- **`crearNegocio`** (`internalMutation`): args `{ nombre, emailAdmin, zonaHoraria?, baseUrl? }`.
  - Valida: nombre no vacío y ≤ 80; email con la **misma** `EMAIL_RE` que usuarios/invitaciones.
  - **Unicidad global:** rechaza si ya hay un `usuario` con ese email (índice `por_email`) o un `negocio`
    con ese `emailAdmin`. Coherente con `invitaciones.activar`/`usuarios.invitar` (un email = un usuario).
  - Inserta `negocios` (estado `activo`, zona por defecto `America/Mexico_City`) y la **invitación del
    primer admin** (rol `admin`, token aleatorio de 32 bytes, 7 días). **No** reutiliza `usuarios.invitar`
    porque este exige una sesión admin y aquí el negocio aún no tiene ninguno.
  - Devuelve `{ negocioId, invitacionId, emailAdmin, token, enlaceActivacion }` (el enlace solo si se pasa
    `baseUrl`; nunca hardcodea URLs). El admin fija **contraseña + zona horaria + nombre** al activar
    (`invitaciones.activar`, flujo JUA-8 ya existente).
- **`listarNegocios`** (`internalQuery`): negocios con `estado`, `emailAdmin`, `zonaHoraria`, nº de usuarios
  y estado de onboarding del admin (`activo` / `pendiente` / `sin_invitacion`). No expone tokens.
- **`qaBorrarNegocio`** (`internalMutation`, **gateado por `QA_HELPERS=1`**, inerte en prod): borra un
  negocio de prueba y sus dependientes (usuarios + sesiones + invitaciones) para no dejar residuo en los
  drivers. Mismo patrón sancionado que los `qa*` de notificaciones.

## Criterios de aceptación (JUA-41)

| Criterio | Cómo se cumple |
|---|---|
| Crear un negocio sin acceder a la BD | `npx convex run negocios:crearNegocio '{...}'` |
| Dispara la invitación del admin | Crea la invitación `pendiente` (rol admin) y devuelve el enlace de activación |
| Negocio visible en el listado | `negocios:listarNegocios` |

## Caveat honesto — envío de email

El envío del correo por **Resend sigue pendiente** en el proyecto (hoy las invitaciones se comparten con
"copiar enlace"). `crearNegocio` **crea la invitación y devuelve el enlace**; el envío automático real
quedará al integrar Resend. No se sobre-declara "email enviado".

## Verificación (dev, driver-37, 10/10)

Reporte `tmp/drivers-jua41/reporte-alta-negocio-dev.txt`; negocio de prueba **borrado** al final; sin secretos.

- **Creación:** `crearNegocio` → negocio + invitación + enlace `…/activar?token=…`.
- **`porToken`:** la invitación se ve `pendiente` / rol `admin` / `requiereZona`.
- **Listado:** el negocio aparece con admin `pendiente`, luego `activo`.
- **Guards (4):** rechaza `emailAdmin` duplicado, email de usuario ya existente, email inválido y nombre
  vacío.
- **Activación real (JUA-8):** `activar` crea el admin y fija zona/nombre; el listado pasa a `activo`.
- **Post-activación:** el email ya es de un usuario → `crearNegocio` lo rechaza.

```txt
npx tsc --noEmit  OK    npx eslint  OK    npm run build  OK (25 rutas)    convex dev --once  OK
```

## Uso operativo previsto

```
npx convex run negocios:crearNegocio '{"nombre":"Inmobiliaria X","emailAdmin":"admin@x.mx","baseUrl":"https://<prod>"}' --prod
# → devuelve enlaceActivacion para compartir con el admin
npx convex run negocios:listarNegocios '{}' --prod
```

## Constancia

Módulo nuevo; sin cambios de esquema. No desplegado, sin `git push`, sin tocar prod/remoto. El helper QA
queda inerte en prod (`QA_HELPERS` ausente, verificable con `npx convex env get`).
