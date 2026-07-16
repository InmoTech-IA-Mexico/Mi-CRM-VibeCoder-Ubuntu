# Acta de auditoría — Rol Observador / solo lectura (JUA-42) · v1

Fecha de auditoría: 2026-07-16  
Commit auditado: `e363250`  
Base productiva declarada y corroborada: `f11d868`  
Base funcional anterior: `757abc0`  
Estado corroborado: candidato local; **no publicado en `origin/main` y no desplegado**  
Veredicto: **NO-GO**

---

## Resultado del dictamen

No se autoriza el despliegue de `e363250` en su estado actual.

La incorporación del literal `observador`, el helper central de autorización y la mayor parte del ocultamiento de acciones están correctamente encaminados. Sin embargo, el inventario independiente encontró una mutación pública de datos del negocio que el observador todavía puede ejecutar: `clientes.sincronizarInactividad`.

Esa función puede cambiar clientes a estado `inactivo`. El hecho de que la UI del observador ya no la invoque, de que la operación sea idempotente o de que exista un cron no convierte la función pública en solo lectura ni impide su llamada directa.

La entrega tampoco cierra de forma inequívoca la afirmación de alcance “consulta todas las pantallas del CRM”: varias pantallas y queries continúan siendo exclusivamente administrativas. Debe definirse expresamente si el Observador consulta solo el núcleo Inicio/Clientes/Estado o si también debe consultar, en modo lectura, Ventas, Resumen y Supervisión.

El primer hallazgo basta por sí solo para el NO-GO.

## Integridad del candidato

- `e363250` es hijo directo de `f11d868`.
- `f11d868` es hijo directo de `757abc0`.
- El tramo `757abc0..f11d868` contiene únicamente evidencia versionada de JUA-44; no cambia la aplicación funcional.
- `HEAD` y `main` apuntaban a `e363250` durante la auditoría.
- `origin/main` permanecía en `f11d868`.
- El árbol estaba limpio antes de crear esta acta ignorada dentro de `tmp/`.
- El delta `f11d868..e363250` contiene 28 archivos, `+247 −123`.
- `git diff --check f11d868..e363250` terminó sin errores.

No se detectaron archivos ajenos al alcance declarado dentro del delta.

---

## B-1 — Una mutación pública permite escritura al Observador

**Severidad: BLOQUEANTE.**

### Evidencia

`resolverSesionEscritura` aplica correctamente la regla central:

- Resuelve la sesión.
- Devuelve `null` si el usuario es `observador`.
- Las mutaciones protegidas rechazan ante ese resultado.

No obstante, `clientes.sincronizarInactividad` sigue usando `resolverSesion`, no `resolverSesionEscritura`:

```ts
export const sincronizarInactividad = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sesion = await resolverSesion(ctx, token);
    // ...
    const cambiados = await transicionarClientes(ctx, clientes, seguimientos, ahora);
    return { cambiados };
  },
});
```

`resolverSesion` admite a cualquier usuario activo, incluido el Observador. `transicionarClientes` ejecuta `ctx.db.patch` sobre los clientes que cumplen la regla de inactividad y cambia `estado` y `actualizadoEn`.

Por tanto, un Observador con una sesión válida puede invocar directamente la mutación y adelantar el momento en que uno o más clientes pasan a `inactivo`.

La documentación oficial de Convex confirma que las funciones declaradas con `mutation` forman parte del API público y son accesibles desde clientes; recomienda que cada función pública compruebe la autorización y que la lógica que no deba ser invocable por clientes sea interna: [Authentication — Authorization](https://docs.convex.dev/auth/overview), [Internal Functions](https://docs.convex.dev/functions/internal-functions).

### Por qué las decisiones de alcance no cierran el hallazgo

- **“La UI no la dispara”:** la autorización no puede depender de que la UI omita una llamada.
- **“Es mantenimiento”:** sigue escribiendo registros del CRM y la identidad que decide cuándo ejecutarla es una sesión de usuario.
- **“Es idempotente”:** idempotencia significa que repetirla converge al mismo resultado; no significa ausencia de efectos.
- **“El cron la hace igualmente”:** el cron define un momento controlado por el sistema. La mutación pública permite que el usuario controle ese momento.

### Acción requerida

La variante pública que usa Inicio debe rechazar al Observador mediante la misma política de escritura. La transición global del cron ya está correctamente separada como `internalMutation`.

Debe añadirse una negativa directa con sesión real de Observador que demuestre:

1. Respuesta de no autorización.
2. Cero cambios en `estado` y `actualizadoEn` de los clientes.
3. El flujo de Inicio de admin y operativo sigue sincronizando con normalidad.

---

## B-2 — “Todas las pantallas” no tiene una implementación ni prueba inequívoca

**Severidad: BLOQUEANTE DE ALCANCE para ratificar el criterio declarado.**

El acta sometida a dictamen define al Observador como alguien que “consulta todas las pantallas del CRM”. El candidato, sin embargo, conserva los guards anteriores de solo administrador:

- `/ventas` no aparece en la navegación y redirige a `/inicio`; `ventas.resumen` devuelve `null` a cualquier no-admin.
- `/resumen` redirige a `/inicio`; `oportunidades.reporteMensual` es solo admin.
- `/supervision` redirige a `/inicio`; `seguimientos.panelSupervision` es solo admin.
- `/usuarios`, `/etiquetas`, `/exportar-datos` y `/papelera` continúan siendo solo admin.

No se considera automáticamente incorrecto conservar privadas las pantallas operativas de administración, pero sí es incompatible con la redacción literal del alcance y con el copy “consulta todo” mientras no se defina qué significa “todo”.

### Acción requerida

Antes del siguiente dictamen debe elegirse y documentarse una de estas dos interpretaciones:

1. **Lectura del núcleo CRM:** Inicio, Clientes, ficha y Estado del negocio. En este caso, corregir el alcance y convertirlo en una lista explícita de pantallas permitidas/excluidas.
2. **Lectura de todas las vistas de negocio:** habilitar al Observador para consultar también las métricas y paneles definidos por producto, manteniendo fuera o en modo no accionable las operaciones administrativas.

El driver debe validar la lista acordada, incluida la navegación por URL directa y la autorización de las queries correspondientes.

---

## Inventario independiente de mutaciones

Se localizaron **38 mutaciones públicas** y 5 internas.

### Escrituras ordinarias de datos del negocio

Hay **15**, no 14 ni una cifra implícita:

- 5 de clientes: crear, actualizar, cambiar estado, prioridad y etiquetas.
- 1 de notas: crear.
- 2 de oportunidades: crear y cambiar etapa.
- 1 de ventas: crear.
- 4 de seguimientos: crear, reprogramar, cancelar y eliminar.
- 1 de Inicio: marcar seguimiento realizado.
- 1 de mantenimiento público: sincronizar inactividad.

Las primeras 14 quedan bloqueadas por `resolverSesionEscritura`, directamente o mediante `seguimientoGestionable`. La última no.

Por ello, la frase del acta productiva “15 mutaciones ... pasan a `resolverSesionEscritura`” no coincide con el código. Hay 12 sitios de llamada al helper que protegen 14 exports públicos; `sincronizarInactividad` permanece fuera.

### Escrituras exclusivamente administrativas

Las defensas existentes son suficientes para bloquear al Observador en:

- Papelera y eliminación de clientes.
- Eliminación de notas y oportunidades.
- Creación, renombrado y eliminación de etiquetas.
- Invitación, reenvío, revocación y reactivación de usuarios.
- Solicitud de exportaciones.

### Auth, cuenta propia y flujos públicos

No se objeta que el Observador pueda:

- Iniciar, extender y cerrar su propia sesión.
- Cambiar su contraseña actual.
- Actualizar el nombre y email de su propia cuenta.
- Usar los flujos pre-sesión de invitación y recuperación.

`exportaciones.consumir` continúa deliberadamente gateada por el token de exportación, no por rol; esa decisión pertenece al dictamen ya cerrado de JUA-44.

---

## Revisión de UI

La revisión estática confirma una implementación coherente en el núcleo probado:

- El FAB se oculta para el Observador.
- La ficha oculta editar, cambio de estado, papelera, notas, oportunidades, registro de ventas y programación/gestión de recordatorios.
- Prioridad y etiquetas pasan a presentación de solo lectura.
- Las tarjetas de oportunidad dejan de abrir la hoja de cambio de etapa.
- Los botones de contacto `tel:` y `mailto:` se conservan.
- Los estados vacíos no ofrecen crear clientes.
- Existen guards en las 7 rutas de alta/edición declaradas.
- El selector de invitación ofrece los tres roles y expone `aria-pressed`.

Las dos capturas preservadas son compatibles con estas afirmaciones:

- La ficha de Ana García se presenta sin controles de escritura.
- La hoja de invitación ofrece Administrador, Operativo y Observador.

El ocultamiento visual no subsana B-1, pero sí evita acciones fallidas en el flujo ordinario.

---

## Evidencia y pruebas

### Verificaciones repetidas por auditoría

```text
npx tsc --noEmit   OK — código 0
npx eslint .       OK — código 0
npm run build      OK — código 0; 25 rutas generadas
node --check driver-20-observador.js   OK
```

No se ejecutó `npx convex dev --once`, porque publica funciones en el deployment de desarrollo y la auditoría no tiene autorización para realizar cambios externos.

### Driver UI preservado

El código del driver contiene 17 comprobaciones efectivas: tres dentro del bucle de roles y catorce adicionales. Su cobertura respalda Inicio, lista, ficha y tres redirecciones.

Persisten estas limitaciones de evidencia:

1. No existe reporte de stdout/JSON que permita corroborar independientemente la corrida declarada 17/17.
2. El driver no vigila `pageerror` ni `console.error`.
3. De los 7 guards de ruta existentes, solo prueba 3: nuevo cliente, nueva nota y nueva venta.
4. No prueba editar cliente, nueva oportunidad, nuevo recordatorio desde ficha ni nuevo seguimiento global.
5. La comprobación de Inicio para el FAB usa una expresión amplia y no verifica individualmente cada acción.
6. No existe limpieza ni revocación del usuario QA; el acta declara que permanece activo en dev.

Estas limitaciones no originan el NO-GO, pero deben corregirse al revalidar la remediación.

### Negativas de servidor

La evidencia preservada no incluye script, transcripción ni reporte de las negativas declaradas. La revisión estática sí confirma el rechazo de los 13 casos enumerados en el acta.

La cobertura dinámica descrita omite dos casos relevantes:

- `seguimientos.crear`, que sí está protegido estáticamente.
- `clientes.sincronizarInactividad`, que no está protegido y constituye B-1.

Para el siguiente dictamen debe conservarse un reporte sanitizado de las 15 negativas de datos del negocio y de una lectura positiva representativa.

---

## Observaciones no bloqueantes

### OBS-1 — Un Observador puede recibir tareas que nunca podrá completar

`usuarios.equipo` devuelve a todos los usuarios activos, incluidos los Observadores. Los selectores de “empleado” y “responsable” consumen esa lista sin filtrar por rol. Un admin puede, por tanto, asignar un seguimiento a un Observador; este lo verá en su agenda pero el servidor le impedirá marcarlo, reprogramarlo o cancelarlo.

**Sugerencia:** excluir Observadores de destinos/responsables accionables o definir explícitamente el sentido de asignarles tareas de solo consulta.

### OBS-2 — “403” no está acreditado como código HTTP

El helper hace que las funciones lancen `Error("No autorizado")`; no implementa ni prueba un status HTTP 403. En la documentación conviene decir “rechazo de servidor por no autorización” salvo que se preserve una prueba del transporte que demuestre exactamente 403.

### OBS-3 — Comentarios históricos de dos roles

Persisten comentarios que describen activación y pantallas como “admin / operativo” o “ambos roles”. No afectan el comportamiento tipado, pero deben actualizarse gradualmente para evitar matrices de autorización ambiguas.

### OBS-4 — El usuario QA activo requiere cierre

El usuario `observador.qa@test.mx` queda activo en dev. Al cerrar el ciclo debe revocarse o documentarse como cuenta QA permanente con credenciales custodiadas fuera del repositorio y sesiones saneadas.

---

## Condiciones para levantar el NO-GO

1. Bloquear a `observador` en `clientes.sincronizarInactividad` antes de cualquier lectura o escritura de negocio.
2. Probar que el rechazo no modifica `estado` ni `actualizadoEn`.
3. Conservar negativas de las **15** mutaciones públicas que escriben datos del negocio.
4. Definir el alcance real de pantallas de consulta y alinear issue, acta, UI, queries y driver.
5. Ejercitar las 7 rutas guardadas, no solo 3.
6. Repetir `tsc`, `eslint`, build y publicación de funciones en dev en código 0.
7. Recomendada: resolver o documentar la asignación de recordatorios a Observadores.

Una remediación mínima de B-1 es pequeña, pero debe someterse a un nuevo dictamen; no se autoriza inferir GO sobre un commit futuro.

## Dictamen final

`e363250` **no debe desplegarse**.

El modelo de autorización central y la UI de solo lectura son una base adecuada, pero una cuenta definida como Observador todavía conserva una vía pública para modificar datos del CRM. Debe cerrarse esa vía y precisarse la superficie de lectura antes de aprobar JUA-42.

## Constancia de auditoría

Durante esta revisión no se modificó código de aplicación, no se desplegaron funciones, no se hizo `git push`, no se iniciaron sesiones, no se invocaron mutaciones, no se alteraron datos de desarrollo o producción y no se realizaron acciones en Linear.

Se efectuaron únicamente lecturas de Git y archivos locales, compilaciones/verificaciones locales sin mutación funcional, consulta de documentación oficial y la creación de esta acta dentro de `tmp/`.
