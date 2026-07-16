# Acta de auditoría — Rol Observador / solo lectura (JUA-42) · v2

Fecha de auditoría: 2026-07-16  
Commits auditados: `e363250` + `e0933ad`  
Base productiva: `f11d868`  
Base funcional anterior: `757abc0`  
Referencia: dictamen v1 = **NO-GO**  
Estado corroborado: candidatos locales; no publicados en `origin/main` y no desplegados  
Veredicto: **GO CON OBSERVACIONES NO BLOQUEANTES**

---

## Resultado del dictamen

Se levanta el NO-GO del dictamen v1 y se autoriza el despliegue de la serie `e363250` + `e0933ad`, sujeto al orden y a las comprobaciones productivas indicadas en esta acta.

Los dos asuntos bloqueantes quedaron suficientemente cerrados:

- `clientes.sincronizarInactividad` ya corta la ejecución del Observador antes de cualquier lectura o escritura de datos.
- El alcance se definió como **núcleo CRM en modo lectura**, con una lista explícita de pantallas incluidas y excluidas.

La observación sobre asignar tareas a usuarios que no pueden completarlas también quedó resuelta con defensa doble: filtrado en la query de equipo y validación en la mutación.

No se encontraron vías públicas adicionales que permitan al Observador crear, editar o eliminar datos del negocio.

Las precisiones restantes afectan el texto del acta y la robustez de los drivers, no el comportamiento de autorización del candidato.

## Integridad de la serie

- `e0933ad` es hijo directo de `e363250`.
- `e363250` es hijo directo de `f11d868`.
- `HEAD` y `main` apuntaban a `e0933ad` durante la auditoría.
- `origin/main` permanecía en `f11d868`.
- El árbol estaba limpio antes de crear esta acta dentro de `tmp/`.
- El delta de remediación `e363250..e0933ad` contiene 3 archivos, `+10 −5`.
- Los únicos archivos de la remediación son `convex/clientes.ts`, `convex/seguimientos.ts` y `convex/usuarios.ts`.
- La serie completa `f11d868..e0933ad` contiene 29 archivos, `+257 −128`.
- `git diff --check` no reportó errores ni en la remediación ni en la serie completa.

---

## B-1 — Escritura mediante `sincronizarInactividad`

**Estado: RESUELTO.**

La mutación pública usa ahora `resolverSesionEscritura`:

```ts
const sesion = await resolverSesionEscritura(ctx, token);
if (!sesion) return { cambiados: 0 };
```

Para un Observador, el helper devuelve `null`. El retorno sucede antes de:

- Obtener `Date.now()` para la transición.
- Consultar `clientes` o `seguimientos`.
- Invocar `transicionarClientes`.
- Ejecutar cualquier `ctx.db.patch`.

La defensa está en el servidor y no depende de la omisión de la llamada en Inicio.

La mutación interna `transicionarInactivos` utilizada por el cron no cambió. Por tanto, la automatización global conserva su funcionamiento y no amplía la superficie pública.

### Inventario resultante

El backend conserva 38 mutaciones públicas y 5 internas.

Las 15 mutaciones públicas que pueden escribir datos del negocio quedan cubiertas así:

- 14 lanzan no autorización al Observador mediante `resolverSesionEscritura` o `seguimientoGestionable`.
- `clientes.sincronizarInactividad` aplica el mismo helper y, por contrato histórico de esa función, devuelve `{ cambiados: 0 }` sin efectos.

No queda ninguna de las 15 con acceso a operaciones de base de datos después de identificar una sesión de Observador.

### Evidencia dinámica preservada

El reporte `reporte-obs-servidor-dev.txt` declara y enumera **18 PASS / 0 FAIL**:

- 2 lecturas positivas.
- 14 rechazos de mutaciones de negocio.
- 1 comprobación de `cambiados = 0` para la sincronización.
- 1 comparación de estados antes/después.

El código del driver coincide con esos 18 resultados y pasa la comprobación sintáctica de Node.

---

## B-2 — Alcance de consulta

**Estado: RESUELTO POR DEFINICIÓN EXPLÍCITA.**

Se acepta la interpretación adoptada:

### Incluido: núcleo CRM en lectura

- Inicio: agenda y panel de inactividad.
- Clientes: lista, búsqueda y filtros.
- Ficha: perfil, historial, oportunidades y recordatorios.
- Estado global de clientes.

### Excluido: administración y analítica reservada

- Ventas.
- Resumen mensual.
- Supervisión.
- Gestión de usuarios.
- Papelera.
- Gestión de etiquetas.
- Exportación de datos.

Esta definición es coherente con los guards y queries existentes: el Observador recibe la misma superficie de consulta central que el operativo, pero sin facultades de escritura.

No se requiere cambio de código para B-2. La corrección necesaria era de alcance y documentación.

El driver UI ahora comprueba `/estado` y las siete rutas de alta/edición. La lista de rutas del driver coincide con los siete usos de `useGuardEscritura` encontrados en la aplicación.

---

## OBS-1 — Observadores asignables a seguimientos

**Estado: RESUELTA.**

La solución aplica defensa en dos niveles:

1. `usuarios.equipo` excluye usuarios activos cuyo rol sea `observador`; ya no aparecen en los selectores.
2. `seguimientos.crear` rechaza en servidor a un Observador tanto como `empleadoId` como `responsableId`.

Las validaciones de servidor también comprueban que el usuario exista, pertenezca al negocio y esté activo. No se encontró una combinación de `destino`, `empleadoId` y `responsableId` que eluda el rechazo.

Esto evita que un admin cree tareas que queden permanentemente no gestionables por su responsable.

---

## Revisión de la UI y guards

Se mantiene lo corroborado en el dictamen v1:

- FAB oculto para el Observador.
- Sin edición, cambio de estado ni papelera en la ficha.
- Sin creación de notas, oportunidades, ventas o recordatorios.
- Prioridad y etiquetas en modo de presentación.
- Sin gestión de recordatorios.
- Sin apertura de la hoja de cambio de etapa.
- Acciones de contacto `tel:` y `mailto:` preservadas.
- Estados vacíos sin enlaces de creación.
- Siete pantallas de alta/edición protegidas por `useGuardEscritura`.
- Selector de invitación con los tres roles y estado accesible mediante `aria-pressed`.

Las capturas preservadas continúan siendo compatibles con la implementación auditada. `e0933ad` no modifica frontend.

---

## Verificaciones repetidas por auditoría

```text
npx tsc --noEmit   OK — código 0
npx eslint .       OK — código 0
npm run build      OK — código 0; 25 rutas generadas
node --check driver-20-observador.js             OK
node --check driver-21-observador-servidor.js     OK
```

No se repitió `npx convex dev --once`, porque publica funciones en el deployment de desarrollo y el equipo auditor no está autorizado para alterar servicios externos. Su resultado en código 0 consta en el acta sometida a dictamen.

## Revisión de los reportes

### Driver 20 — UI

El reporte preservado indica **23 PASS / 0 FAIL** y coincide con el código:

- 22 comprobaciones funcionales.
- 1 comprobación global sin `pageerror` ni `console.error` inesperados.

La lista de exclusiones del vigilante está acotada a mensajes relacionados con `beforeunload`/Chromestatus. El reporte final registra cero errores inesperados.

### Driver 21 — servidor

El reporte preservado indica **18 PASS / 0 FAIL** y no contiene tokens, contraseñas ni cadenas hexadecimales que aparenten tokens.

Las 14 mutaciones ordinarias se invocan con sesión real de Observador y se exige que el error sea de autorización. La sincronización se prueba por separado porque su contrato devuelve un contador en lugar de lanzar error.

---

## Observaciones no bloqueantes

### OBS-2 — “Las 15 rechazan” no describe exactamente el contrato

La frase del acta v2 “las 15 mutaciones ... rechazan al observador” debe precisarse:

- 14 rechazan con error de no autorización.
- `sincronizarInactividad` reconoce la sesión como no habilitada para escritura y devuelve `{ cambiados: 0 }`.

Ambos comportamientos impiden escrituras; la diferencia es documental y de observabilidad, no de seguridad.

### OBS-3 — El snapshot dinámico no contiene todos los campos solicitados

El driver compara `[_id, estado]` obtenidos mediante `clientes.listar`. No compara `actualizadoEn` y la query excluye papelera.

La revisión estática demuestra una garantía más fuerte —el retorno ocurre antes de cualquier acceso a base de datos—, por lo que no se requiere cambio para el GO. Para que el reporte respalde literalmente “cero escrituras”, convendría capturar mediante una función QA autorizada `estado`, `actualizadoEn` y el conjunto completo del negocio.

### OBS-4 — Admin y operativo no ejecutan la sincronización en el driver 21

El acta afirma que admin y operativo siguen sincronizando con normalidad, pero el driver 21 solo usa la sesión admin para lecturas de contraste; no invoca `sincronizarInactividad` con admin ni con operativo.

El código conserva ambos roles porque `resolverSesionEscritura` solo excluye `observador`. La afirmación debe presentarse como revisión estática o añadirse una prueba positiva sobre un fixture controlado.

### OBS-5 — Los drivers no garantizan saneamiento ante excepción

Los drivers escriben el reporte y cierran sesiones/navegador únicamente en la ruta normal. Una excepción previa puede impedir el reporte y dejar sesiones QA vivas.

**Sugerencia:** envolver recursos y sesiones en `try/finally`; escribir también un reporte de fallo y establecer exit code después del saneamiento.

### OBS-6 — Profundidad de las lecturas del núcleo

La prueba de `/estado` confirma la URL y ausencia de texto “No autorizado”, pero no aserta métricas concretas. Inicio comprueba la ausencia del FAB, no la carga de agenda e inactividad. Las lecturas positivas de servidor se limitan a lista y ficha.

La autorización está respaldada estáticamente, pero en producción conviene verificar contenido real de las cuatro superficies del núcleo.

### OBS-7 — OBS-1 carece de negativa dinámica específica

La defensa contra asignar un Observador está completa en código, pero los reportes no contienen intentos directos de `seguimientos.crear` con una sesión admin y el Observador como empleado/responsable.

Se recomienda añadir ambos casos al recorrido productivo; no bloquea porque la validación está en la mutación y se ejecuta antes del `insert`.

### OBS-8 — Durabilidad final pendiente del cierre

Los drivers y reportes viven todavía en `tmp/`, directorio ignorado por Git. Esto es coherente con el flujo del ciclo activo, siempre que después de la ratificación productiva se saniticen y copien a `auditorias/` como indica el plan de despliegue.

---

## Comprobaciones mínimas en producción

1. Desplegar primero esquema y funciones de Convex; después publicar el frontend.
2. Invitar y activar un usuario QA con rol Observador.
3. Confirmar lectura con contenido real en Inicio, Clientes, ficha y Estado global.
4. Ejecutar las 14 negativas con error y la sincronización no-op; confirmar cero cambios.
5. Intentar asignar al Observador como empleado y responsable mediante llamada directa con sesión admin; ambas deben fallar.
6. Confirmar las siete redirecciones y ausencia de acciones en la ficha.
7. Revocar al usuario QA y comprobar que su sesión deja de ser válida.
8. Archivar evidencia sanitizada en `auditorias/` y actualizar el estado de producción.

## Dictamen final

La serie `e363250` + `e0933ad` queda **APROBADA PARA DESPLIEGUE**.

B-1 y B-2 están cerrados; OBS-1 está resuelta con defensa de UI/query y servidor. No se requiere otro cambio de código antes del despliegue. Las observaciones de este dictamen deben reflejarse en la redacción final y, cuando corresponda, en la evidencia productiva.

## Constancia de auditoría

Durante esta revisión no se modificó código de aplicación, no se desplegaron funciones, no se hizo `git push`, no se iniciaron sesiones, no se invocaron mutaciones, no se alteraron datos de desarrollo o producción y no se realizaron acciones en Linear.

Se efectuaron únicamente lecturas de Git y archivos locales, compilaciones/verificaciones locales sin mutación funcional y la creación de esta acta dentro de `tmp/`.
