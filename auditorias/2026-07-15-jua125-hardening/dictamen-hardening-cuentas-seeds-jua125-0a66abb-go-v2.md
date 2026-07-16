# Acta de dictamen — Hardening de cuentas y seeds (JUA-125) · v2

Fecha: 2026-07-15  
Commits auditados: `e22efd9` + `0a66abb`  
Base productiva declarada: `ec35df3`  
Referencia: dictamen v1 = **NO-GO**  
Estado corroborado: candidatos locales, no publicados en `origin/main`  
Veredicto: **GO CON OBSERVACIONES DOCUMENTALES NO BLOQUEANTES**

---

## Resultado del dictamen

Se levanta el NO-GO del dictamen v1.

`0a66abb` corrige la vía de persistencia de una sesión administrativa comprometida: `usuarios.reactivar` rechaza la propia cuenta del administrador y cualquier cuenta activa que ya tenga contraseña antes de efectuar una escritura.

La regeneración de un enlace perdido también tiene ahora una ruta real y coherente. Una cuenta activa que aún no ha fijado contraseña se identifica explícitamente en la respuesta del servidor y la UI ofrece **Nuevo enlace**; regenerar invalida el token anterior.

La separación de contraseñas iniciales del seed quedó estricta, sin fallback genérico, y la configuración necesaria está presente y separada en los dos deployments revisados.

No se encontraron defectos funcionales, de autorización, aislamiento por negocio o compatibilidad que impidan desplegar los dos commits candidatos. Las precisiones restantes corresponden a exactitud y conservación de evidencia.

## Integridad del delta

- `0a66abb` es hijo directo de `e22efd9`.
- `e22efd9` es hijo directo de `ec35df3`.
- `HEAD` y `main` apuntaban a `0a66abb`; `origin/main` permanecía en `ec35df3` durante la auditoría.
- El árbol de trabajo se encontraba limpio antes de crear esta acta.
- El delta de remediación `e22efd9..0a66abb` contiene exactamente tres archivos y `+46/−13`:
  - `convex/usuarios.ts`: `+16`.
  - `convex/seed.ts`: `+7/−9`.
  - `src/app/(app)/usuarios/_components/pantalla-usuarios.tsx`: `+23/−4`.
- No hay cambios adicionales de schema, dependencias o configuración de runtime.
- `git diff --check e22efd9..0a66abb` no reportó errores.

## Revisión de los bloqueantes del dictamen v1

### B-1 — Escalada desde una sesión admin

**Estado: RESUELTO.**

La mutación aplica ahora, en este orden:

1. Resolución de una sesión con rol admin.
2. Rechazo si `usuarioId` corresponde al propio administrador.
3. Lectura del objetivo y validación del mismo negocio.
4. Admisión únicamente si el objetivo está:
   - Inactivo; o
   - Activo y sin `passwordHash`.
5. Solo después comienzan el patch, la eliminación de sesiones y la sustitución de recuperaciones.

Una cuenta activa con contraseña ya no puede entrar en el flujo. Por tanto, una sesión administrativa robada no puede borrar el hash de su propia cuenta, obtener un token de recuperación y eludir la contraseña actual exigida por `auth.cambiarPassword`.

La excepción Activo sin contraseña es acotada y necesaria para B-2: representa una reactivación todavía incompleta. Regenerar mantiene el objetivo sin contraseña, elimina cualquier sesión residual y reemplaza el único enlace vigente.

El aislamiento por negocio sigue derivándose de la sesión y se valida antes de cualquier escritura. Convex ejecuta la mutación de forma transaccional, por lo que el borrado del token anterior y la creación del nuevo son atómicos.

### Pruebas negativas

El responsable declara haber ejercitado directamente en desarrollo:

- Propia cuenta admin activa: rechazo “No puedes reactivar tu propia cuenta”.
- Otro usuario activo con contraseña: rechazo “Solo se puede reactivar a un usuario revocado”.
- Hashes y recuperaciones sin cambios; sesiones conservadas tras ambos rechazos.

No se repitieron esas mutaciones durante esta auditoría para no alterar autenticación ni datos. La ubicación de los guards antes del primer `patch` corrobora estáticamente la ausencia de efectos para ambos casos.

El caso cross-negocio no es dinámicamente ejercitable en el deployment de desarrollo actual. La defensa está presente en servidor mediante la comparación del `negocioId` del objetivo con el derivado de la sesión.

### B-2 — Regeneración del enlace perdido

**Estado: RESUELTO.**

`usuarios.listar` expone `enlacePendiente` únicamente cuando el usuario está Activo y no tiene `passwordHash`.

La UI usa esa señal para mostrar, junto a **Revocar**, el botón **Nuevo enlace**. El botón vuelve a invocar el flujo de reactivación sobre el único estado Activo permitido por el servidor, abre la hoja con el token nuevo y deja invalidado el anterior.

Cuando `recuperacion.restablecer` fija la contraseña, `passwordHash` vuelve a existir; la consulta reactiva cambia `enlacePendiente` a `false` y el botón desaparece. La tarjeta conserva solo **Revocar**.

El copy de la hoja describe ahora exactamente esa ruta y advierte que el enlace anterior se invalida.

## Revisión del seed

### Secrets obligatorios por rol

**OBS-1 del dictamen v1: RESUELTA.**

`passwordInicialDemo(rol)` solo consulta:

- `SEED_DEMO_PASSWORD_ADMIN`.
- `SEED_DEMO_PASSWORD_OPERATIVO`.

Ya no consulta `SEED_DEMO_PASSWORD` ni contiene fallback. Si falta la variable específica, el seed falla con un mensaje que identifica su nombre.

La evaluación continúa dentro del operando derecho perezoso de `??`; por tanto, el secret solo se lee y hashea al crear el usuario. Reejecutar el seed no cambia contraseñas existentes.

Mediante consultas de configuración de solo lectura y sin mostrar valores se corroboró:

- Producción: ambas variables específicas presentes, valores distintos y variable genérica ausente.
- Desarrollo: ambas variables específicas presentes, valores distintos y variable genérica ausente.

No se detectaron contraseñas literales nuevas en el delta.

## Verificaciones independientes

- `npx tsc --noEmit`: código 0.
- `npx eslint .`: código 0.
- `npm run build`: código 0.
- Build Next.js 16.2.10: 23 páginas generadas; `/usuarios` incluida.
- `node --check tmp/drivers-jua125/driver-15-hardening-v2.js`: código 0.
- `git diff --check e22efd9..0a66abb`: sin errores.
- Las tres capturas disponibles son PNG válidos de 390×844.

No se ejecutó `npx convex dev --once`, Playwright, logins ni funciones de aplicación durante esta auditoría. Sus resultados se tomaron de la evidencia aportada para evitar mutar el deployment de desarrollo.

## Evidencia funcional revisada

El driver v2 contiene trece comprobaciones funcionales y una comprobación global de errores del navegador, coherente con el resumen **14 PASS / 0 FAIL** del reporte.

La cobertura observable en el código del driver incluye:

- Reactivación y copy corregido.
- Cierre de la hoja y aparición de **Nuevo enlace**.
- Token regenerado distinto.
- Token anterior inválido y token nuevo válido.
- Fijación de contraseña y login.
- Uso único.
- Desaparición de **Nuevo enlace** después de crear la contraseña.
- Revocación y expulsión de la sesión viva.
- Vigilancia de `pageerror` y `console.error` en las tres páginas creadas.
- Intento de limpieza dentro de `finally`.
- Escritura del reporte incluso ante excepciones ocurridas dentro del recorrido principal.

El reporte preservado indica:

- Base URL local de desarrollo.
- Fecha de ejecución.
- Usuario QA.
- `14 PASS / 0 FAIL`.
- Cero errores inesperados del navegador.
- Ninguna contraseña persistida.

El escaneo del reporte no encontró tokens completos, parámetros `token=` ni cadenas hexadecimales de 64 caracteres.

La captura `d15-nuevo-enlace.png` muestra a Verónica Activa, con **Nuevo enlace** y **Revocar**, y respalda visualmente la ruta corregida de B-2.

## Observaciones documentales no bloqueantes

### OBS-1 — La sección de tokens del reporte no contiene los prefijos anunciados

El driver define `redactar(url)`, pero nunca lo utiliza. Además, `enlace1` y `enlace2` se declaran con `const` dentro del bloque `try`; al construir el reporte fuera de ese bloque, `typeof enlace1` resulta `"undefined"` y se escribe `enlace1: n/a`.

No existe exposición: el reporte no contiene ningún token, lo cual es incluso más seguro. La imprecisión está en la frase “enlaces solo con prefijo”, no en la sanitización efectiva.

**Sugerencia:** omitir por completo la sección de enlaces y declarar “tokens no persistidos”. Si se necesita correlación, conservar únicamente un hash no reversible; no es necesario publicar prefijos de bearer tokens.

### OBS-2 — La limpieza en `finally` es de mejor esfuerzo

La limpieza intenta volver a `/usuarios`, localizar **Revocar** y pulsarlo, pero cualquier error se captura y descarta. Por ello, “deja el QA inactivo pase lo que pase” es más fuerte que lo que el driver garantiza por sí solo.

El acta declara que el estado final se verificó y el recorrido exitoso sí revoca explícitamente antes del `finally`, de modo que no afecta esta corrida ni el dictamen funcional.

**Sugerencia:** registrar en el reporte `cleanup: PASS/FAIL`, comprobar que reaparece **Reactivar** después de la limpieza y hacer que un fallo de saneamiento produzca exit code distinto de cero.

### OBS-3 — La captura de la hoja corresponde al flujo v1

`d14-hoja-reactivado.png` conserva el copy anterior que decía “vuelve a pulsar Reactivar”. Es evidencia histórica válida del ciclo v1, pero no acredita el nuevo copy. La única captura nueva, `d15-nuevo-enlace.png`, sí acredita el botón corregido.

**Sugerencia:** al archivar, etiquetar las capturas `d14-*` como evidencia v1 y añadir una captura v2 de la hoja con el texto **Nuevo enlace** para evitar contradicciones visuales.

### OBS-4 — Las negativas de servidor carecen de reporte separado

La evidencia durable cubre el driver UI, pero no contiene la transcripción sanitizada de las dos negativas directas, comparación completa de hashes ni conteos de recuperaciones/sesiones.

La revisión estática confirma los guards y su orden, por lo que esta carencia no bloquea el GO.

**Sugerencia:** antes de archivar el cierre, conservar un reporte booleano que no incluya hashes ni tokens: caso, rechazo esperado, `hash_unchanged`, `sessions_unchanged` y `recoveries_unchanged`.

## Verificación productiva recomendada

Con la luz verde del responsable y respetando el orden backend → frontend:

1. Desplegar primero las funciones de Convex.
2. Publicar `0a66abb` y esperar Railway SUCCESS con ese hash.
3. Confirmar que Marta y Carlos continúan autenticando normalmente, sin regenerar ni alterar sus cuentas.
4. Con un usuario QA inactivo:
   - Reactivar y cerrar la hoja.
   - Confirmar **Nuevo enlace**.
   - Regenerar y verificar que el token anterior es inválido.
   - Fijar contraseña con el token nuevo e iniciar sesión.
   - Confirmar que **Nuevo enlace** desaparece.
   - Revocar y comprobar la expulsión inmediata.
5. Confirmar la limpieza final de sesiones, recuperaciones y estado del QA.
6. Archivar evidencia sanitizada y actualizar JUA-125 y el estado de producción.

No es necesario tocar datos de Marta o Carlos para probar los guards negativos en producción; esa defensa quedó cubierta en desarrollo y por revisión estática.

## Dictamen de cierre

Se concede **GO para desplegar `e22efd9` + `0a66abb`**.

- B-1: resuelto.
- B-2: resuelto.
- OBS-1 del seed: resuelta.
- Revocación inmediata y flujo nominal: conservados.
- Observaciones restantes: documentales y de robustez del driver, no funcionales.

El despliegue y las acciones posteriores requieren la luz verde explícita del responsable; este dictamen no los ejecuta.

## Constancia de auditoría

Durante esta revisión no se modificó código de aplicación, no se desplegaron funciones, no se hizo `git push`, no se ejecutaron drivers, logins o mutaciones, no se alteraron usuarios, sesiones, contraseñas o variables de entorno y no se realizaron acciones en Linear.

Se efectuaron únicamente lecturas de Git y archivos locales, comprobaciones locales sin mutación funcional, consultas de configuración de Convex que no revelaron valores, inspección de evidencia y la creación de esta acta dentro de `tmp/`.
