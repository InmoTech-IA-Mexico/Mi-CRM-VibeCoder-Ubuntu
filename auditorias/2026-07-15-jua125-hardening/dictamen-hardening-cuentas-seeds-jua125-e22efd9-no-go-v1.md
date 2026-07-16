# Acta de dictamen — Hardening de cuentas y seeds (JUA-125) · v1

Fecha: 2026-07-15  
Commit auditado: `e22efd9`  
Base productiva declarada: `ec35df3`  
Base funcional previa: `6af3964`  
Estado corroborado: candidato local, no publicado en `origin/main`  
Veredicto: **NO-GO — VALIDACIÓN DE ESTADO Y REGENERACIÓN SEGURA REQUERIDAS**

---

## Resultado del dictamen

La eliminación inmediata de sesiones al revocar, la anulación de la contraseña anterior al reactivar y la separación efectiva de secretos iniciales por rol están correctamente encaminadas. El flujo nominal probado en desarrollo cumple el objetivo principal de JUA-125.

No obstante, `usuarios.reactivar` quedó expuesta como mutación pública para cualquier cuenta del mismo negocio, sin exigir que el usuario esté inactivo y sin impedir que el administrador la aplique sobre su propia cuenta. Esto permite que quien posea una sesión administrativa vigente la convierta en una contraseña nueva sin conocer la contraseña actual.

La interfaz oculta esa posibilidad, pero la autorización debe imponerse en servidor. Por tratarse precisamente de un cambio de hardening de autenticación, el hallazgo impide desplegar `e22efd9` en su estado actual.

También debe resolverse la contradicción del flujo de recuperación: después de reactivar, la interfaz deja de mostrar **Reactivar**, aunque la hoja promete que ese botón permitirá regenerar un enlace perdido.

## Hallazgo bloqueante

### B-1 — `reactivar` permite convertir una sesión admin en control persistente de la cuenta

La mutación en `convex/usuarios.ts` realiza estas comprobaciones:

- La sesión existe y pertenece a un administrador.
- El usuario objetivo pertenece al mismo negocio.

No comprueba:

- Que el usuario objetivo tenga `estado === "inactivo"`.
- Que el objetivo sea distinto del administrador de la sesión.
- Que una cuenta activa con contraseña deba conservar su credencial.

Después de esas dos únicas validaciones, la mutación:

1. Cambia el objetivo a Activo.
2. Elimina su `passwordHash`.
3. Elimina todas sus sesiones.
4. Genera y devuelve un token de recuperación de 24 horas.

Una sesión administrativa comprometida puede obtener su propio `usuarioId` desde `usuarios.listar`, invocar `usuarios.reactivar` sobre esa misma cuenta y usar el token devuelto en `recuperacion.restablecer` para fijar una contraseña elegida por el atacante. La eliminación de la sesión actual no protege contra el flujo porque el token se devuelve como resultado de la misma mutación y el restablecimiento no requiere una sesión.

Esto evita el control de `auth.cambiarPassword`, que sí exige conocer la contraseña actual, y transforma una sesión de hasta ocho horas en acceso persistente a la cuenta administrativa. También permite aplicar el borrado de credencial a cualquier otra cuenta activa del negocio sin pasar por la transición de revocación prevista.

La condición visual que solo presenta **Reactivar** para tarjetas inactivas no constituye una frontera de seguridad: la mutación puede invocarse directamente.

### Acción requerida para B-1

El servidor debe definir y validar explícitamente los estados permitidos. Como mínimo:

1. Una reactivación inicial solo debe aceptar un usuario inactivo del mismo negocio.
2. Debe rechazarse aplicar el flujo a una cuenta activa con contraseña, incluida la propia cuenta del administrador.
3. El rechazo debe ocurrir antes de modificar estado, hash, sesiones o recuperaciones.
4. Deben añadirse pruebas negativas de servidor que acrediten que intentar reactivar:
   - la propia cuenta admin activa;
   - otra cuenta activa con contraseña;
   - una cuenta de otro negocio;
   no modifica credenciales, sesiones ni enlaces.

Una opción segura es mantener `reactivar` estrictamente para el estado Inactivo y crear una operación separada de regeneración. Si se reutiliza la misma mutación, el estado adicional admisible debería limitarse a una cuenta activa **sin** `passwordHash`, con un enlace de alta pendiente, y nunca a la cuenta que ejecuta la operación.

## Incumplimiento funcional asociado

### B-2 — El enlace perdido no puede regenerarse como afirma la interfaz

La hoja indica: “si se pierde, vuelve a pulsar Reactivar para generar otro”. Sin embargo:

- Al completar la mutación, la consulta reactiva muestra al usuario como Activo.
- Para usuarios activos, la tarjeta presenta únicamente **Revocar**.
- **Reactivar** solo se renderiza para usuarios inactivos.
- El token vive únicamente en el estado del componente; cerrar la hoja o recargar la página lo hace inaccesible desde la UI.
- `recuperacion.solicitar` tampoco ofrece autoservicio a ese usuario porque ya no tiene `passwordHash`.

El propio driver 14a confirma como PASS que, al cerrar la hoja, la tarjeta muestra **Revocar**, no **Reactivar**. Por tanto, la evidencia contradice el copy y la decisión de alcance declarada.

Existe un rodeo manual —Revocar y luego Reactivar—, pero no es la acción descrita, deja temporalmente una cuenta Activa sin posibilidad de autenticarse y obliga al administrador a descubrir una transición de dos pasos.

### Acción requerida para B-2

Antes del GO debe elegirse y probarse una conducta coherente:

- **Regeneración explícita recomendada:** identificar en la respuesta de `usuarios.listar` que la cuenta activa aún no tiene contraseña y ofrecer **Generar nuevo enlace**. El servidor solo debe permitirlo para ese estado pendiente y debe invalidar el token anterior.
- **Flujo de dos pasos:** si se conserva Revocar → Reactivar, el copy debe explicarlo con exactitud y la prueba debe cubrirlo. Es funcionalmente posible, aunque menos claro.

La prueba mínima debe cerrar o recargar la hoja antes de copiar, obtener después un enlace nuevo por el flujo soportado y verificar que el token anterior queda inválido y el nuevo permite fijar la contraseña.

## Integridad del delta

- `e22efd9` es hijo directo de `ec35df3`.
- `HEAD` y `main` apuntaban a `e22efd9`; `origin/main` permanecía en `ec35df3` durante la auditoría.
- El árbol de trabajo se encontraba limpio antes de crear esta acta.
- El delta contiene exactamente tres archivos y `+130/−14`:
  - `convex/usuarios.ts`.
  - `convex/seed.ts`.
  - `src/app/(app)/usuarios/_components/pantalla-usuarios.tsx`.
- No hay cambios de schema ni archivos adicionales de runtime.
- `git diff --check ec35df3..e22efd9` no reportó errores.

## Aspectos técnicos conformes

### Revocación inmediata

`desactivar` conserva las validaciones preexistentes —rol admin, mismo negocio, prohibición de autorrevocación y último administrador— y elimina todas las sesiones del usuario dentro de la misma mutación de Convex. El cambio de estado y la eliminación son atómicos.

Además, `resolverSesion` continúa rechazando usuarios inactivos. La eliminación física de sesiones añade correctamente la defensa en profundidad solicitada por OBS-1.

### Reactivación nominal

Para un objetivo inactivo legítimo, la implementación:

- Elimina el hash anterior mediante un patch a `undefined`.
- Reinicia intentos y bloqueo.
- Elimina sesiones residuales.
- Elimina recuperaciones previas.
- Genera 32 bytes aleatorios, codificados como 64 caracteres hexadecimales.
- Establece 24 horas de vigencia.

El mecanismo existente de recuperación valida estado Activo, caducidad y uso único; al fijar la nueva contraseña marca el token como usado y vuelve a eliminar todas las sesiones.

### Aislamiento por negocio

Tanto `desactivar` como `reactivar` derivan el negocio de la sesión y rechazan un usuario cuyo `negocioId` sea distinto. No se observó una vía cross-negocio en el código revisado.

### Seeds por rol

`passwordInicialDemo(rol)` selecciona `SEED_DEMO_PASSWORD_ADMIN` o `SEED_DEMO_PASSWORD_OPERATIVO`. La evaluación ocurre únicamente dentro del operando derecho perezoso de `??`, por lo que un usuario existente conserva su contraseña.

Mediante consultas de configuración de solo lectura, sin mostrar valores, se corroboró que:

- Ambas variables específicas existen en Convex producción.
- Ambas variables específicas existen en Convex desarrollo.
- Los valores de admin y operativo son distintos en cada entorno.

No se encontró una contraseña literal nueva en el delta.

## Observaciones no bloqueantes

### OBS-1 — El fallback genérico debilita la separación en deployments futuros

Las configuraciones actuales usan correctamente los secretos específicos y distintos. No obstante, si falta una variable específica, el código recurre silenciosamente a `SEED_DEMO_PASSWORD`; en un deployment nuevo esto puede volver a compartir una misma contraseña inicial entre roles.

**Sugerencia:** una vez confirmada la migración de todos los entornos, eliminar el fallback genérico y hacer obligatorias ambas variables por rol. Si se conserva por transición, documentar una fecha o condición de retiro.

### OBS-2 — Evidencia de ejecución no preservada todavía

Los dos drivers pasan `node --check`, contienen seis comprobaciones cada uno y las dos capturas son PNG válidos de 390×844. Las imágenes respaldan la hoja de reactivación y la expulsión al login.

No existe aún un reporte durable con stdout de los 12 PASS y los drivers no vigilan `pageerror` ni `console.error`. No se reejecutaron porque alterarían usuarios, contraseñas y sesiones de desarrollo; se tomó como declarada la ejecución funcional y se revisó su código.

**Sugerencia:** en la corrida de remediación, conservar un reporte sanitizado, añadir vigilancia de errores inesperados y usar limpieza en `finally` para que una interrupción no deje una cuenta QA activa o un token pendiente sin registrar.

### OBS-3 — El driver escribe temporalmente el token completo

El driver 14a escribe el enlace de recuperación en el archivo recibido como argumento para que 14b lo consuma. En el ciclo declarado el token terminó usado y la cuenta volvió a Inactivo, por lo que quedó inerte.

**Sugerencia:** antes de archivar la evidencia, confirmar que el token fue consumido o invalidado, excluir el archivo puente del archivo público y conservar en el reporte únicamente un hash o una forma redactada del token.

## Verificaciones independientes

- `npx tsc --noEmit`: código 0.
- `npx eslint .`: código 0.
- `npm run build`: código 0 al ejecutarlo con acceso a las fuentes externas requeridas por Next.js.
- Primer intento de build dentro de la red restringida: falló únicamente al descargar Geist y Lora desde Google Fonts; no fue un fallo del código. La repetición autorizada compiló y generó las 23 páginas.
- `node --check tmp/drivers-jua125/driver-14a-reactivar.js`: código 0.
- `node --check tmp/drivers-jua125/driver-14b-nueva-password.js`: código 0.
- `git diff --check ec35df3..e22efd9`: sin errores.

No se ejecutó `npx convex dev --once` durante la auditoría para evitar publicar funciones en desarrollo. Se acepta como evidencia declarada el resultado aportado por el responsable.

## Criterios para un nuevo dictamen

Un commit de remediación podrá recibir GO cuando:

1. El servidor rechace reactivar cuentas activas con contraseña y la propia cuenta del administrador.
2. El flujo de enlace perdido tenga una ruta real, visible y coherente con el copy.
3. Las negativas de servidor demuestren que los rechazos no modifican hash, sesiones, estado ni recuperaciones.
4. Se repita el ciclo nominal: inactivo → enlace → contraseña nueva → login → uso único → revocación inmediata.
5. Se pruebe la regeneración: el token anterior queda inválido y el nuevo funciona.
6. `tsc`, `eslint` y build permanezcan en código 0.

No se solicita alterar el mecanismo de recuperación ya auditado ni ampliar el alcance a correo real.

## Dictamen

**NO-GO para desplegar `e22efd9`.**

El cambio no debe llegar a Convex producción ni al frontend productivo hasta corregir B-1 y alinear B-2. Los componentes de revocación, recuperación nominal y seeds pueden conservarse como base de la remediación.

## Constancia de auditoría

Durante esta revisión no se modificó código de aplicación, no se desplegaron funciones, no se hizo `git push`, no se ejecutaron drivers, logins ni mutaciones, no se alteraron usuarios, sesiones, contraseñas o variables de entorno y no se realizaron acciones en Linear.

Se efectuaron únicamente lecturas de Git y archivos locales, comprobaciones locales sin mutación funcional, consultas a Convex limitadas a nombres y comparación no reveladora de variables, inspección de capturas y la creación de esta acta dentro de `tmp/`.
