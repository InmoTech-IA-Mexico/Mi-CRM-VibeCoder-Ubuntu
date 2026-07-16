# Acta de dictamen — Follow-ups de cierre de auth (JUA-7 · JUA-8/9 · JUA-29) · v1

Fecha: 2026-07-15  
Commit candidato: `fc02288` (sobre producción actual `2cc9d44`)  
Estado: construido y verificado en local + desarrollo de Convex. **No desplegado.**  
Veredicto: **GO CON OBSERVACIONES NO BLOQUEANTES**

---

## Resultado del dictamen

El commit `fc02288` parte directamente de `2cc9d44`, el árbol se encontraba limpio durante la auditoría y el alcance coincide exactamente con los seis archivos y `+129/−19` declarados.

No se encontraron regresiones funcionales o de seguridad que bloqueen su paso a producción.

## Fundamento

### Recuperación solo para usuarios activos

Tanto `recuperacion.porToken` como `recuperacion.restablecer` comprueban en servidor que el usuario exista y tenga `estado === "activo"`.

La protección no depende de la interfaz. Un enlace emitido antes de revocar el acceso queda inutilizable mientras la cuenta esté inactiva. Que vuelva a ser válido al reactivar al usuario dentro de sus 24 horas de vigencia es coherente con la decisión documentada de invalidación por estado.

### Unicidad global al invitar

`usuarios.invitar` normaliza el correo y consulta el índice global `usuarios.por_email`, sin filtrar por negocio. Por lo tanto, satisface el follow-up de impedir una nueva invitación cuando ya existe una cuenta con ese correo en cualquier negocio.

Los rechazos de email no válido, cuenta existente e invitación pendiente utilizan `ConvexError`. La hoja de invitación consume correctamente `error.data` y conserva un mensaje genérico para errores no controlados.

### Bienvenida de activación

La bienvenida se evalúa antes que el nuevo estado reactivo de la invitación, evitando que la transición a `aceptada` tape la pantalla final.

La sesión se guarda antes de mostrar la bienvenida y el botón **Empezar** navega mediante `router.replace("/inicio")`. Este uso coincide con la API instalada de Next.js 16.2.10.

Las variantes de operativo y administrador, así como los textos, negocio, iconografía y halos, coinciden sustancialmente con la especificación y las capturas aportadas.

### Integridad del cambio

- `fc02288` tiene como padre directo a `2cc9d44`.
- El diff contiene exactamente los seis archivos declarados.
- `git diff --check 2cc9d44..fc02288` no reporta errores.
- Las cuatro capturas revisadas corresponden con los resultados descritos.

## Observaciones no bloqueantes

### OBS-1 — La bienvenida no sobrevive una recarga

El estado `bienvenida` existe únicamente en memoria del componente. Si el navegador se recarga después de activar, la invitación ya figura como aceptada y se presenta “Cuenta ya activada”, aunque exista una sesión válida en `localStorage`.

No deja la cuenta inaccesible porque el usuario puede iniciar sesión con la contraseña recién creada, pero interrumpe la experiencia prevista.

**Sugerencia:** persistir temporalmente los datos de bienvenida en `sessionStorage`, o permitir continuar a `/inicio` desde el estado de invitación aceptada cuando se valide una sesión vigente.

### OBS-2 — Accesibilidad de la bienvenida

El nombre utiliza `gold-500` (`#C9A25E`) sobre el fondo crema (`#FBF8F1`), con un contraste aproximado de **2.25:1**, inferior al mínimo WCAG AA de 3:1 para texto grande.

La animación `glowpulse` tampoco contempla la preferencia `prefers-reduced-motion`, y el cambio dinámico a la pantalla de éxito no tiene anuncio o gestión de foco específicos para lectores de pantalla.

**Sugerencia:** usar `gold-text` o `gold-700` para el nombre, desactivar el halo mediante `motion-reduce` y focalizar el encabezado o anunciar el resultado con una región de estado.

### OBS-3 — Evidencia automatizada no preservada

Los 21 PASS están documentados y las capturas respaldan los flujos principales, pero no se localizaron drivers ni un reporte Playwright conservado en el repositorio o en `tmp/`.

**Sugerencia:** archivar el driver o un reporte verificable en futuros dictámenes de autenticación para permitir su reproducción independiente.

### OBS-4 — Riesgo futuro al habilitar varios negocios

La comprobación de usuarios existentes ya es global, pero las invitaciones pendientes continúan comprobándose dentro del negocio actual y `reenviar` no revalida el correo contra usuarios existentes.

Esto es aceptable para el alcance y estado actuales del producto, donde no existe un flujo para crear un segundo negocio.

**Sugerencia:** antes de habilitar aprovisionamiento multinegocio, impedir invitaciones pendientes globalmente duplicadas o revalidarlas al reenviar.

## Decisiones de alcance aprobadas

- Se aprueba el copy neutro **“¡Te damos la bienvenida, {nombre}!”**.
- Se aprueba omitir el indicador **“Paso 3 de 3”**, porque el flujo productivo no conserva la estructura de tres pantallas del diseño.
- Se considera suficiente para este dictamen la comprobación estática del índice global y el ejercicio con un usuario existente del negocio demo.
- Se acepta mantener `reenviar` fuera del cambio actual, dejando registrado el riesgo futuro.

## Dictamen de liberación

**GO para que el responsable autorizado ejecute el proceso de despliegue**, seguido de verificación en vivo.

Comprobaciones mínimas posteriores al despliegue:

1. Una cuenta inactiva no puede consultar ni consumir un enlace de recuperación previamente emitido.
2. Una invitación con un email ya registrado presenta “Ya existe una cuenta con ese email” en producción.
3. Las activaciones de operativo y administrador muestran su bienvenida y **Empezar** conduce a `/inicio` con sesión válida.
4. Convex y Railway corresponden al commit candidato `fc02288`.

JUA-7 y JUA-8/9 deben permanecer abiertas hasta completar el envío real de correo mediante Resend.

## Constancia de auditoría

Durante esta revisión no se modificó código, no se desplegaron funciones, no se hizo `git push` y no se alteraron datos de producción o desarrollo.
