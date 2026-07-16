# Acta para dictamen — Hardening de cuentas y seeds (JUA-125) · v1

Fecha: 2026-07-15
Commit candidato: `e22efd9` (sobre prod actual `ec35df3`; app funcional previa `6af3964`)
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Origen: OBS-1 y OBS-2 del dictamen GO de la remediación B-1.
Veredicto: **PENDIENTE DE DICTAMEN (GO/NO-GO)**

--------------------------------------------------------------------

## Alcance (JUA-125, proyecto "Resto del PRD")

Cerrar las dos ventanas señaladas por el auditor: (a) revocar a un usuario no mataba sus sesiones
vivas, y (b) reactivarlo revalidaba su contraseña anterior (potencialmente conocida/expuesta) y
cualquier sesión sin expirar. Además, separar por rol el secreto inicial del seed (OBS-2).

--------------------------------------------------------------------

## Cambios (3 archivos, +130 −14)

**`convex/usuarios.ts`**
- Helper `eliminarSesiones(usuarioId)`.
- **`desactivar`** ahora borra TODAS las sesiones del usuario tras marcarlo inactivo — la
  revocación surte efecto inmediato (defensa en profundidad sobre el rechazo por estado que ya
  hacía `resolverSesion`).
- **`reactivar`** ya no revalida nada del pasado: pone `estado: activo` **anulando el
  `passwordHash`** (patch a undefined = campo eliminado), resetea intentos/bloqueo, borra las
  sesiones que quedaran y los enlaces de recuperación previos, y **emite un enlace de nueva
  contraseña** reutilizando el mecanismo de recuperación de JUA-7 (token de 32 bytes, 24 h, un solo
  uso; mismas pantallas `/nueva-password`). Devuelve el token al cliente admin.

**`src/app/(app)/usuarios/_components/pantalla-usuarios.tsx`**
- Al pulsar Reactivar se abre una hoja "Usuario reactivado": explica que la contraseña anterior
  quedó anulada y las sesiones cerradas, indica la vigencia (24 h, un solo uso, regenerable
  re-pulsando Reactivar) y ofrece **"Copiar enlace de nueva contraseña"** (mismo patrón que el
  "Copiar enlace" de las invitaciones — la entrega por email sigue bloqueada por el dominio/Resend).

**`convex/seed.ts`** — `passwordInicialDemo(rol)`: lee `SEED_DEMO_PASSWORD_ADMIN` o
`SEED_DEMO_PASSWORD_OPERATIVO` según el rol (respaldo: `SEED_DEMO_PASSWORD` genérica; error claro
si no hay ninguna). Variables ya configuradas en dev y prod con valores aleatorios distintos
(solo en los deployments). Sigue aplicándose únicamente al CREAR el usuario.

--------------------------------------------------------------------

## Decisiones de alcance (para tu revisión)

- **Reactivar = enlace de nueva contraseña, no re-invitación:** `invitaciones.activar` crea
  usuarios nuevos (rechaza emails existentes); el mecanismo de recuperación de JUA-7 ya cubre
  exactamente "fijar contraseña con token de un solo uso" con pantallas auditadas. Menos código
  nuevo, mismas garantías.
- El usuario reactivado **no puede autoservirse** un enlace (`recuperacion.solicitar` exige
  `passwordHash`, y él no tiene): el enlace lo controla el admin, coherente con el modelo manual
  del MVP.
- Si el enlace caduca o se pierde: re-pulsar Reactivar genera otro (invalida el anterior).
- `desactivar` no borra los enlaces de recuperación pendientes: ya quedan inservibles por el check
  de `estado === "activo"` de JUA-7, y `reactivar` los purga y re-emite.
- El caso de creación de usuarios demo con env por rol no se ejercitó en vivo (requeriría
  `seed:limpiar` en dev): el camino es directo (`??` perezoso al crear), tipado, y las variables
  existen en ambos deployments (`env list`).

--------------------------------------------------------------------

## Verificación ejecutada (0 errores)

```txt
npx tsc --noEmit       OK
npx eslint .           OK
npm run build          OK
npx convex dev --once  OK
```

**Drivers Playwright (dev, 390×844, credenciales admin por VARIABLE DE ENTORNO — política nueva):
12/12 PASS** — `tmp/drivers-jua125/` (14a reactivación · 14b consumo y revocación).

- **14a (6/6):** Marta reactiva a Verónica (QA inactiva) → hoja "Usuario reactivado" con la
  explicación y la vigencia → "Copiar enlace" confirma la copia y el portapapeles contiene
  `/nueva-password?token=<64 hex>` → la tarjeta pasa a Activo.
- **Estado intermedio verificado por datos (CLI):** la fila de Verónica quedó **sin campo
  `passwordHash`** · 0 sesiones · login con su contraseña ANTERIOR → `ok: false` (la reactivación
  no revalidó la credencial vieja — el punto exacto de OBS-1) · 1 recuperación pendiente.
- **14b (6/6):** el enlace abre `/nueva-password` → fija contraseña nueva (aleatoria, no
  persistida) → `/login?reset=1` → entra con la nueva (sesión viva) → **reusar el enlace da
  "Enlace ya utilizado"** → Marta la revoca → **la sesión viva muere al instante: al recargar, la
  página de Verónica cae en `/login`** (desactivar borró sesiones) → verificado también en datos
  (0 sesiones).

Capturas: `tmp/capturas-jua125/` (hoja de reactivación · expulsión de la sesión revocada).
Estado final en dev: Verónica inactiva de nuevo (como estaba), ahora con hash aleatorio no
publicado — mejor que antes del ciclo.

--------------------------------------------------------------------

## Si el dictamen es GO

Con tu OK explícito: `npx convex deploy` (funciones primero — la UI nueva usa el retorno de
`reactivar`) → `git push` → Railway → verificación en vivo (ciclo revocar/reactivar con un usuario
QA de prod, sin tocar marta/carlos) → JUA-125 Done en Linear + comentario → archivar acta +
evidencia a `auditorias/` (escaneo de secretos previo) → actualizar `tmp/estado-produccion.md`.
