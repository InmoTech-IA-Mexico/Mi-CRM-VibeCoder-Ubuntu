# Acta de dictamen — Exportación de datos en autoservicio (JUA-44) · v2

Fecha de auditoría: 2026-07-16  
Commits auditados: `4108c0d` + `d951ac6`  
Parent real de la serie: `66a36f8`  
Base funcional: `0a66abb`  
Referencia: dictamen v1 = **NO-GO**  
Estado corroborado: candidatos locales; no desplegados en Convex ni Railway  
Veredicto: **GO CON OBSERVACIONES DE EVIDENCIA NO BLOQUEANTES**

---

## Resultado del dictamen

Se levanta el NO-GO del dictamen v1.

`d951ac6` corrige los dos bloqueantes en el único módulo afectado:

- Los campos string se neutralizan antes del escape RFC 4180 cuando comienzan con un iniciador de fórmula; los números reales conservan su tipo y representación.
- Los CSV de oportunidades y recordatorios incorporan los campos persistidos que faltaban y resuelven sus referencias a nombres legibles.

La neutralización se corroboró adicionalmente mediante una importación sintética en LibreOffice: el archivo de control produjo una celda fórmula, mientras que la versión con apóstrofo produjo cero fórmulas y todas sus celdas como texto.

No se encontraron regresiones de autorización, aislamiento, consumo único, temporalidad, formato o compatibilidad que impidan desplegar la serie candidata.

La evidencia de QA contiene varias imprecisiones que deben corregirse antes de archivarla: el reporte vigente del driver 16 es `11 PASS / 1 FAIL`, no 12/12; el borrado temporal no está dentro de `finally`; y el driver 17 no ejercita todos los iniciadores que el código sí cubre. Estas diferencias no reabren B-1/B-2 porque la implementación quedó verificada estáticamente y mediante pruebas independientes.

## Integridad del delta

- `d951ac6` es hijo directo de `4108c0d`.
- `4108c0d` es hijo directo de `66a36f8`.
- `HEAD` y `main` apuntaban a `d951ac6`; `origin/main` permanecía en `66a36f8`.
- El árbol de trabajo se encontraba limpio antes de crear esta acta.
- El delta `4108c0d..d951ac6` modifica exactamente un archivo:
  - `convex/exportaciones.ts`: `+28/−8`.
- No cambia schema, rutas, UI, cron, dependencias ni API pública.
- `git diff --check 4108c0d..d951ac6` no reportó errores.

La corrección de base aportada por el responsable es exacta: `66a36f8` contiene evidencia de auditoría respecto de `4b72f65`, sin modificar la aplicación funcional.

## Revisión de los bloqueantes

### B-1 — CSV/Formula Injection

**Estado: RESUELTO, con el compromiso de compatibilidad documentado.**

El serializador aplica ahora:

1. `null`/`undefined` → campo vacío.
2. `number` → representación numérica directa.
3. Cualquier otro valor → string no confiable.
4. Si el string comienza con un iniciador, antepone `'`.
5. Después ejecuta el escape RFC 4180 de comas, comillas y saltos.

La expresión regular cubre:

- ASCII: `=`, `+`, `-`, `@`.
- Controles: tabulador, CR y LF.
- Ancho completo: `＝`, `＋`, `－`, `＠`.

La defensa se aplica en el helper común que serializa cabeceras y filas de los cuatro CSV; por tanto, alcanza nombres, teléfonos, correos, etiquetas, descripciones, comentarios, motivos, títulos y referencias resueltas.

Los valores numéricos como `monto: -500` no se prefijan. En cambio, `telefono: "+52…"` es string y se protege como texto.

La [guía de CSV Injection de OWASP](https://owasp.org/www-community/attacks/CSV_Injection) reconoce el prefijo de texto y el citado del campo como una estrategia de mitigación, advirtiendo que no existe un comportamiento universal entre hojas de cálculo y procesos de guardado/reapertura.

### Corroboración independiente en LibreOffice

Se crearon dos CSV exclusivamente sintéticos en `/tmp`, sin datos del CRM:

- Control sin neutralización.
- Mismos valores con apóstrofo de prefijo.

Ambos se importaron de forma headless a XLSX y se inspeccionó su XML interno:

```txt
Control:       1 celda fórmula
Neutralizado:  0 celdas fórmula · 6 celdas string
```

El control almacenó `<f>1+1</f>` para `=1+1`; la versión neutralizada no generó elementos de fórmula.

Los archivos y perfiles sintéticos se eliminaron después de la comprobación.

### Precisión de compatibilidad

LibreOffice preservó el apóstrofo dentro del valor string. Esto acredita la seguridad inicial, pero no la frase del comentario de código y del acta que afirma que la hoja “no lo muestra” en todos los lectores.

La diferencia es visual —por ejemplo podría verse `'+52…`— y no reactiva la fórmula. Debe documentarse como compromiso de compatibilidad y verificarse manualmente en la versión de Excel objetivo durante la prueba productiva.

### B-2 — Campos persistidos omitidos

**Estado: RESUELTO.**

#### `oportunidades.csv`

Se añadieron:

- **Comentarios** → `comentarios`.
- **Actualizada por** → `actualizadoPor`, resuelto mediante el mapa de usuarios.

La posición de cabeceras y valores coincide. Los campos existentes permanecen en el mismo orden relativo salvo las inserciones declaradas.

#### `recordatorios.csv`

Se añadieron:

- **Oportunidad** → `oportunidadId`, resuelto mediante `nombreOpo`.
- **Fecha fin** → `fechaFin`, convertida a la zona del negocio.
- **Día de recurrencia** → `diaRecurrencia`, conservado como número.
- **Creado** → `_creationTime`, convertido a la zona del negocio.

El mapa de oportunidades que antes quedaba sin uso ahora participa en las filas.

La matriz declarada por el responsable coincide con el schema para los cuatro conjuntos de JUA-44. Los IDs internos se sustituyen por referencias legibles y ventas continúa fuera del alcance acordado.

## Verificaciones independientes

- `npx tsc --noEmit`: código 0.
- `npx eslint .`: código 0.
- `npm run build`: código 0; 25 páginas generadas, incluidas `/exportar` y `/exportar-datos`.
- `node --check tmp/drivers-jua44/driver-16-exportar.js`: código 0.
- `node --check tmp/drivers-jua44/driver-17-export-fixtures.js`: código 0.
- `git diff --check 4108c0d..d951ac6`: sin errores.
- No se encontraron `dl-*.csv` dentro del workspace ni bajo `/tmp` al momento de la revisión.
- Reporte driver 17: `11 PASS / 0 FAIL`, cleanup PASS y sin secretos.
- Prueba sintética LibreOffice: control con una fórmula; neutralizado con cero fórmulas.

No se ejecutaron los drivers ni funciones de Convex durante esta auditoría. La prueba de LibreOffice utilizó únicamente valores inventados y no accedió a datos o servicios de la aplicación.

## Evidencia funcional revisada

### Driver 17

El código y el reporte respaldan:

- Neutralización de `=`, `+`, `@` y `-` en cuatro campos distintos.
- Escape conjunto de `@`, coma y comillas.
- Monto numérico negativo sin apóstrofo.
- Cabeceras nuevas de oportunidades y recordatorios.
- Referencias y campos no vacíos en los fixtures.
- Eliminación nominal de oportunidad, recordatorio y cliente.
- Cierre de sesión intentado al finalizar.

El reporte preservado indica `11 PASS / 0 FAIL` y `cleanup: PASS`.

### Driver 16

El flujo posterior al único fallo del reporte demuestra que:

- El enlace admin existía y pudo pulsarse.
- Se generó un token de 64 caracteres hexadecimales.
- La página pública cargó.
- Se interceptaron los cuatro CSV.
- Clientes conservó BOM, cabeceras y datos.
- El enlace quedó usado.
- No hubo `pageerror` ni `console.error` inesperados.

El fallo ocurre en una comprobación inmediata con `isVisible()` del acceso admin. La siguiente instrucción hace `click()` sobre el mismo locator y Playwright espera hasta poder pulsarlo; todo el flujo continúa correctamente. La evidencia es compatible con un falso negativo de sincronización, no con ausencia del acceso.

## Observaciones no bloqueantes

### OBS-1 — El reporte vigente del driver 16 contradice el acta

`reporte-exportar-dev.txt` contiene:

```txt
resultado: CON FALLOS (11 PASS / 1 FAIL)
FAIL — B: el admin ve 'Exportar datos' en Perfil
```

Por tanto, no debe archivarse ni comentarse como “12/12 PASS”. Aunque el click posterior acredita funcionalidad, la corrida terminó con exit code de fallo.

**Sugerencia:** sustituir `isVisible()` instantáneo por `waitFor({ state: "visible" })`, repetir la corrida completa y conservar el nuevo reporte. Registrar con transparencia que la primera corrida tuvo este falso negativo.

### OBS-2 — El driver 16 no limpia en `finally`

Los CSV se guardan correctamente en un directorio creado por `mkdtempSync` fuera del workspace, y la corrida revisada dejó cero residuos. Sin embargo, `rmSync(TMP)` está en la ruta normal después de cerrar el navegador, no dentro de un bloque `finally`.

Una excepción entre la primera descarga y esa línea dejaría los cuatro CSV completos en `/tmp`.

**Sugerencia:** envolver navegador, contextos y directorio temporal en `try/finally`; ejecutar y reportar el borrado en el `finally`, incluso si Playwright falla.

### OBS-3 — La cobertura automática no incluye todos los iniciadores declarados

El driver 17 ejercita ASCII `=`, `+`, `-`, `@`, además de coma y comillas. No crea fixtures que comiencen con:

- Tabulador, CR o LF.
- `＝`, `＋`, `－`, `＠` de ancho completo.

La expresión regular los cubre correctamente y se verificó de forma local, por lo que no hay un defecto conocido.

**Sugerencia:** convertir `csvCampo` en helper unitariamente comprobable o añadir una tabla de casos puros para todos los iniciadores, sin tener que crear un cliente por caso.

### OBS-4 — Las aserciones de completitud no son específicas por columna

La fila de oportunidad comprueba que contiene “Marta Ruiz”, pero Marta también aparece como Responsable; esa condición podría pasar aunque **Actualizada por** estuviera vacía. La fila de recordatorio busca cualquier fecha de 2026, que podría corresponder a **Fecha** y no a **Fecha fin**.

La revisión estática confirmó que ambos valores están en la posición correcta, de modo que no bloquea.

**Sugerencia:** parsear el CSV con una librería o helper de prueba, indexar por nombre de cabecera y comparar cada celda exacta.

### OBS-5 — El apóstrofo puede permanecer visible

En la importación independiente de LibreOffice, el apóstrofo quedó almacenado en `sharedStrings.xml`; no se representó mediante un estilo oculto `quotePrefix`.

**Sugerencia:** corregir el comentario “no muestra” y validar visualmente Excel/LibreOffice. Si la visibilidad no es aceptable, evaluar la mitigación tabulada y citada recomendada para Excel, documentando que también altera el dato subyacente.

### OBS-6 — Reproducibilidad del driver 17

El driver fija `CWD` a `/home/juan/Juan/Proyecto aprendizaje/Vibe CRM`. Una copia versionada no funcionará en otro clon o equipo sin editarla.

**Sugerencia:** usar `process.cwd()`, `import.meta.dirname`/`__dirname` resuelto hacia el repo, o una variable `REPO_DIR`.

### OBS-7 — Reporte ante excepción del driver 17

El cleanup sí está en `finally`, pero no existe un `catch` exterior. Si una llamada CLI lanza, se intenta limpiar y luego la excepción evita llegar a `writeFileSync(REPORTE)`.

**Sugerencia:** acumular la excepción como FAIL, ejecutar cleanup, escribir siempre el reporte y finalmente establecer el exit code.

### Observaciones aceptadas del dictamen v1

Permanecen registradas como mejoras futuras, sin cambio de severidad:

- Token bearer en query string; evaluar fragmento URL, `Referrer-Policy` y `noindex`.
- Límites de una sola mutación para exportaciones grandes.
- Patrón N+1 de notas.
- Purga global sin índice temporal ni batching.

## Criterios del NO-GO v1

1. Defensa documentada contra fórmula: **CUMPLE**.
2. Pruebas de iniciadores y escape: **CUMPLE para ASCII/comillas/coma; controles y Unicode corroborados estáticamente**.
3. Comentarios y último autor en oportunidades: **CUMPLE**.
4. Oportunidad, fecha fin y día de recurrencia en recordatorios: **CUMPLE**.
5. Fixtures no vacíos de oportunidades y recordatorios: **CUMPLE**.
6. Autorización, un solo uso, descarga 4/4 y respaldo: **CUMPLE funcionalmente; reporte requiere corrección documental**.
7. TypeScript, ESLint, build y Convex declarados en 0: **CUMPLE; los tres primeros repetidos independientemente**.
8. CSV reales eliminados antes de archivar: **CUMPLE en el estado revisado**.

## Verificación productiva recomendada

Con la luz verde explícita del responsable:

1. Desplegar funciones/schema/cron antes del frontend.
2. Publicar `d951ac6` y esperar Railway SUCCESS con ese hash.
3. Crear fixtures QA controlados para `=`, `+`, `-`, `@`, comentarios y recurrencia.
4. Descargar y comprobar los cuatro CSV, incluido el contenido por columna.
5. Abrir una copia sintética o QA en la versión de Excel/LibreOffice objetivo y confirmar que no existen celdas fórmula; registrar si el apóstrofo es visible.
6. Verificar un solo uso y regeneración.
7. Eliminar fixtures, sesiones, exports descargados y cualquier `dl-*.csv`.
8. Archivar reportes sanitizados, incluyendo la historia del falso negativo 11/1 si se conserva.

## Dictamen de cierre

Se concede **GO para desplegar `4108c0d` + `d951ac6`**.

- B-1: resuelto.
- B-2: resuelto.
- Autorización, aislamiento, temporalidad y consumo único: conservados.
- Observaciones restantes: evidencia, portabilidad de drivers y compatibilidad visual; no constituyen un defecto productivo conocido.

El despliegue y las acciones externas requieren la autorización del responsable; este dictamen no las ejecuta.

## Constancia de auditoría

Durante esta revisión no se modificó código de aplicación, no se desplegaron funciones, no se hizo `git push`, no se generaron o consumieron exportaciones, no se ejecutaron logins o mutaciones, no se alteraron datos o variables y no se realizaron acciones en Linear.

Se efectuaron lecturas de Git y archivos locales, verificaciones locales sin mutación funcional, una importación LibreOffice con valores exclusivamente sintéticos en `/tmp`, limpieza posterior de esos artefactos y la creación de esta acta dentro de `tmp/`.
