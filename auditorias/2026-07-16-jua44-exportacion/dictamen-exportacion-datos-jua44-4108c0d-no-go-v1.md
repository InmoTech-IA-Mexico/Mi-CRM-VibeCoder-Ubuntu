# Acta de dictamen — Exportación de datos en autoservicio (JUA-44) · v1

Fecha de auditoría: 2026-07-16  
Commit auditado: `4108c0d`  
Parent real: `66a36f8`  
Base funcional: `0a66abb`  
Estado corroborado: candidato local; no desplegado en Convex ni Railway  
Veredicto: **NO-GO — SANITIZACIÓN DE HOJA DE CÁLCULO Y COMPLETITUD DE DATOS REQUERIDAS**

---

## Resultado del dictamen

La solución cumple correctamente la autorización para iniciar exportaciones, el aislamiento por negocio, la aleatoriedad y vigencia del token, el consumo transaccional de un solo uso y la ausencia de almacenamiento permanente de los CSV.

No obstante, `4108c0d` no debe desplegarse todavía por dos hallazgos:

1. Los valores controlados por usuarios se exportan sin neutralizar fórmulas de hoja de cálculo. El archivo se presenta expresamente como compatible con Excel, por lo que un nombre, teléfono, comentario o descripción que comience con caracteres interpretables como fórmula puede ejecutarse al abrirlo.
2. La implementación y la UI prometen “todos los datos”, pero los CSV omiten campos persistidos y funcionalmente relevantes de oportunidades y recordatorios.

Ambos puntos afectan el objetivo principal de JUA-44. El primero es de seguridad y el segundo de integridad/portabilidad de datos.

## Hallazgos bloqueantes

### B-1 — CSV/Formula Injection en campos controlados por usuarios

`csvCampo` implementa correctamente el escape sintáctico de RFC 4180:

- Duplica comillas internas.
- Encierra el campo entre comillas cuando contiene coma, comillas o saltos.
- Conserva CRLF entre filas.

Ese escape impide romper la estructura del CSV, pero no impide que Excel o LibreOffice interpreten una celda como fórmula.

La función devuelve sin cambios textos que empiezan con:

- `=`
- `+`
- `-`
- `@`

Una comprobación local con la lógica exacta del helper produjo:

```txt
=1+1       → =1+1
+1+1       → +1+1
@SUM(A1:A2) → @SUM(A1:A2)
-1+2       → -1+2
```

Aunque un valor con comas quede rodeado por comillas CSV, el programa de hoja de cálculo retira esas comillas al interpretar la celda; citar el campo no neutraliza por sí solo la fórmula.

El riesgo alcanza múltiples datos editables del CRM:

- Nombre, teléfono, email, empresa, cargo, dirección y observaciones del cliente.
- Nombres de etiquetas.
- Descripción y resultado de notas.
- Nombre, producto/servicio, comentarios y motivos de oportunidades.
- Título y descripción de recordatorios.

La [guía de CSV Injection de OWASP](https://owasp.org/www-community/attacks/CSV_Injection) documenta que las hojas de cálculo interpretan entradas no confiables que comienzan con indicadores de fórmula y que el impacto puede incluir ejecución de fórmulas y exfiltración de datos.

#### Acción requerida para B-1

Antes de un nuevo dictamen debe existir una política explícita de serialización segura para hoja de cálculo:

1. Distinguir valores numéricos reales de textos. Un monto numérico puede conservarse como número; los campos string deben tratarse como no confiables.
2. Neutralizar textos cuyo inicio pueda activar fórmulas, incluidos al menos `=`, `+`, `-`, `@`, tabulador, CR y LF, considerando también variantes Unicode de ancho completo si el archivo se abrirá en Excel.
3. Aplicar la neutralización antes del escape RFC 4180 y de manera uniforme a los cuatro CSV.
4. Documentar el compromiso elegido —por ejemplo apóstrofo o tabulador dentro de un campo citado— porque no existe una estrategia idéntica para todos los lectores CSV.
5. Añadir pruebas automáticas con valores maliciosos que incluyan comas, comillas, saltos y cada iniciador de fórmula.
6. Verificar que teléfonos como `+52…` se conserven como texto legible y que montos negativos de tipo number no se corrompan.

La prueba de aceptación debe inspeccionar la celda importada en al menos Excel o LibreOffice, no solo comparar el texto crudo.

### B-2 — La exportación declarada como completa omite campos persistidos

La interfaz dice “Descarga todos los datos del negocio” y el acta declara “CSV legible con todos los datos”. Sin embargo, la matriz esquema → columnas tiene ausencias verificables.

#### `oportunidades.csv`

No exporta:

- `comentarios`: texto capturado al crear una oportunidad.
- `actualizadoPor`: usuario que realizó el último cambio de etapa.

El CSV sí resuelve otros usuarios a nombre, por lo que `actualizadoPor` puede exportarse con la misma estrategia.

#### `recordatorios.csv`

No exporta:

- `oportunidadId`: relación opcional con la oportunidad.
- `fechaFin`: fin de recurrencia.
- `diaRecurrencia`: ancla del día mensual.

La implementación incluso construye `nombreOpo`, pero termina con `void nombreOpo`; la relación quedó preparada y no utilizada.

`fechaFin` y `diaRecurrencia` no son metadatos internos: determinan la conducta de los recordatorios recurrentes. Sin ellos, el CSV no permite reconstruir fielmente la programación exportada.

#### Acción requerida para B-2

1. Crear una matriz explícita de todos los campos de las cuatro entidades y marcar cada uno como:
   - Exportado con valor legible.
   - Resuelto a otra entidad.
   - Omitido intencionalmente con justificación.
2. Añadir como mínimo las columnas anteriores.
3. Considerar también una columna **Creado** para recordatorios si “todos los datos” incluye `_creationTime`, como ya ocurre en clientes y oportunidades.
4. Añadir fixtures con valores no vacíos para comentarios, autor de actualización, oportunidad vinculada, fecha fin y día de recurrencia.
5. Hacer que el driver compruebe esos valores en `oportunidades.csv` y `recordatorios.csv`; hoy solo examina el contenido de `clientes.csv`.

Los IDs internos pueden omitirse si las referencias resueltas son suficientes para el alcance acordado. Este dictamen tampoco exige añadir ventas, porque los cuatro conjuntos definidos por JUA-44 son clientes, notas, oportunidades y recordatorios.

## Integridad del commit y precisión de base

- `4108c0d` es hijo directo de `66a36f8`, no de `4b72f65`.
- `66a36f8` solo añade documentación de auditoría de JUA-125 respecto de `4b72f65`; no cambia la aplicación funcional.
- El commit `4108c0d` contiene exactamente diez archivos y `+599/−1`, coherente con el acta:
  - Schema, cron, API generada y tres módulos Convex.
  - Dos rutas nuevas con sus componentes.
  - Un acceso nuevo en Perfil.
- `HEAD` y `main` apuntaban a `4108c0d`; `origin/main` permanecía en `66a36f8`.
- El árbol estaba limpio antes de crear esta acta.
- `git diff --check 66a36f8..4108c0d` no reportó errores.

La consulta viva de Railway confirmó que el deployment actual está en `SUCCESS` con `commitHash 66a36f8`, no `4b72f65`. La diferencia es documental y no altera la base funcional `0a66abb`, pero debe corregirse en el acta de entrega y en el estado de producción.

`npx convex function-spec --prod` no mostró las funciones `exportaciones:*`, coherente con que el backend candidato todavía no está desplegado en producción.

## Aspectos técnicos conformes

### Autorización e aislamiento

- `solicitar` resuelve la sesión en servidor y exige rol `admin`.
- El `negocioId` de la exportación se deriva exclusivamente de esa sesión.
- El cliente no puede elegir un negocio por argumento.
- La UI oculta el acceso al operativo y lo redirige, mientras el control real permanece en la mutación.
- La página pública de descarga usa el token como credencial bearer, decisión declarada de alcance.

No se encontró una vía para que un operativo genere enlaces ni para que un token de un negocio seleccione datos de otro.

### Token y consumo

- Token generado con 32 bytes aleatorios y codificado como 64 caracteres hexadecimales.
- Vigencia de 24 horas calculada con tiempo del servidor.
- Solicitar uno nuevo elimina los anteriores sin usar del mismo negocio.
- `estado` diferencia inválido, usado y expirado sin exponer los datos.
- `consumir` valida el token y marca `usadoEn` dentro de la misma mutación que genera los CSV.
- Las mutaciones de Convex son transaccionales: si la generación falla, la marca de uso no queda confirmada; dos consumos concurrentes no pueden confirmar ambos sobre el mismo estado.
- Un segundo consumo es rechazado.

### Datos y formato

- Los clientes incluyen papelera y columnas de eliminación.
- Las referencias presentes se resuelven dentro del negocio mediante mapas de clientes, usuarios y etiquetas.
- Las notas de clientes en papelera se incluyen mientras el cliente siga existiendo.
- El BOM y CRLF son correctos.
- Las fechas se convierten mediante la zona horaria configurada del negocio.
- Los cuatro nombres de archivo son constantes y no reciben entrada del usuario.
- Los CSV solo viven en memoria durante la mutación y en el navegador; no se escriben en File Storage.

### Interfaz

- El botón de solicitud evita doble envío con estado ocupado.
- La página de descarga no consume el token al cargar; requiere una acción explícita, lo que reduce consumos accidentales por previsualizadores.
- La vista local de `archivos` conserva los botones de respaldo aunque la query reactiva cambie el enlace a usado.
- Los nombres de descarga son fijos.
- Las capturas muestran los cuatro botones y su estado descargado.

## Observaciones no bloqueantes

### OBS-1 — El bearer token viaja en el query string

El enlace usa `/exportar?token=…` y el Server Component lee `searchParams`. El token completo llega por tanto al servidor web antes de contactar a Convex y puede quedar en historial del navegador, diagnósticos o registros de infraestructura mientras siga vigente.

El token tiene alta entropía, dura 24 horas y es de un solo uso, por lo que no se considera un bypass actual. Sin embargo, concede acceso a la exportación completa.

**Sugerencia:** evaluar un fragmento URL (`/exportar#token=…`) leído únicamente en cliente y retirarlo con `history.replaceState`; añadir `Referrer-Policy: no-referrer` y metadata `noindex, nofollow` específica para `/exportar`. Si se conserva el query string, confirmar y documentar la política de redacción de URLs en logs.

### OBS-2 — Una sola mutación no escala a una exportación arbitraria

`consumir` recopila cinco tablas completas, ejecuta una consulta de notas por cada cliente y devuelve los cuatro CSV en una sola mutación.

Los [límites oficiales de Convex](https://docs.convex.dev/production/state/limits) aplican por transacción: 16 MiB leídos, 32,000 documentos escaneados, 4,096 rangos de índice y 16 MiB de retorno; además las queries/mutations tienen un segundo de código de usuario y 1,000 operaciones de IO concurrentes.

El volumen demo está muy lejos de esos límites, pero el patrón N+1 de notas puede fallar primero al crecer el número de clientes. El cron `purgar` también recorre todas las exportaciones de todos los negocios en una sola transacción.

**Sugerencia:** registrar un umbral de volumen soportado y, antes de aproximarse, migrar a paginación/batches o a un job asíncrono con lifecycle y borrado verificable. Añadir una prueba de volumen que mida bytes, documentos y rangos de transacción.

### OBS-3 — El driver guarda temporalmente los cuatro CSV completos

El driver guarda `dl-clientes.csv`, `dl-notas.csv`, `dl-oportunidades.csv` y `dl-recordatorios.csv` bajo `SHOTS_DIR` para inspeccionarlos, pero no los elimina en `finally`.

En el workspace revisado ya no estaban presentes, por lo que no existe residuo actual. Aun así, una corrida interrumpida puede dejar una copia completa de los datos del negocio junto a las capturas y hacer que se archive accidentalmente.

**Sugerencia:** usar un directorio temporal fuera del árbol de evidencia y eliminarlo en `finally`. Antes de copiar a `auditorias/`, bloquear el archivo si aparecen `dl-*.csv` u otros exports reales.

### OBS-4 — Cobertura y durabilidad de las pruebas de servidor

El reporte del driver preserva `12 PASS / 0 FAIL`, cero errores inesperados del navegador y ningún token. El código del driver coincide con esas doce comprobaciones y pasa `node --check`.

La negativa directa de `solicitar` con rol operativo y la inspección CLI de los cuatro CSV no tienen una transcripción separada en `tmp/drivers-jua44/`. La revisión estática confirma el guard admin, pero los conteos y el contenido de los otros tres CSV quedan respaldados solo por el relato del acta.

**Sugerencia:** conservar un reporte sanitizado de servidor y ampliar el driver para validar cabeceras y fixtures de los cuatro archivos.

### OBS-5 — El cron de purga es global

`purgar` hace `.collect()` de toda la tabla `exportaciones`. Es correcto para el volumen inicial y no expone datos, pero heredará los límites transaccionales indicados en OBS-2.

**Sugerencia:** añadir un índice por `expiraEn` o estado temporal y purgar por lotes cuando crezca el número de negocios/exportaciones.

## Evidencia revisada

### Verificaciones independientes

- `npx tsc --noEmit`: código 0.
- `npx eslint .`: código 0.
- `npm run build`: código 0; 25 páginas generadas, incluidas `/exportar` y `/exportar-datos`.
- `node --check tmp/drivers-jua44/driver-16-exportar.js`: código 0.
- `git diff --check 66a36f8..4108c0d`: sin errores.
- Capturas `d16-enlace-listo.png` y `d16-descargas.png`: PNG válidos de 390×844.
- Reporte `reporte-exportar-dev.txt`: `12 PASS / 0 FAIL`, cero errores inesperados y sin tokens.

No se reejecutaron Playwright, solicitudes, consumos ni funciones de Convex para no crear enlaces ni extraer datos durante la auditoría.

### Límites de la evidencia actual

- El driver inspecciona contenido únicamente en `clientes.csv`.
- No contiene casos de fórmula/inyección.
- No acredita los campos omitidos porque los fixtures y aserciones correspondientes no existen.
- No prueba expiración por tiempo; la lógica se verificó estáticamente.
- No prueba concurrencia de consumo; la garantía se deriva de la transacción Convex.

## Criterios para un nuevo dictamen

Un commit de remediación podrá recibir GO cuando:

1. Los campos string de los cuatro CSV tengan una defensa documentada contra CSV/formula injection.
2. Existan pruebas con `=`, `+`, `-`, `@`, tabulador, CR/LF, comas y comillas.
3. `oportunidades.csv` incluya comentarios y último autor de actualización, o documente una exclusión aceptada.
4. `recordatorios.csv` incluya oportunidad vinculada, fecha fin y día de recurrencia.
5. El driver valide fixtures no vacíos de oportunidades y recordatorios, además de clientes.
6. Se repitan autorización admin/operativo, token de un solo uso, regeneración, descarga 4/4 y botones de respaldo.
7. TypeScript, ESLint, build y compilación Convex permanezcan en código 0.
8. Los CSV reales de QA se eliminen antes de archivar evidencia.

No se exige cambiar la decisión de cuatro archivos ni incorporar ZIP/File Storage para levantar este NO-GO.

## Dictamen

**NO-GO para desplegar `4108c0d`.**

La base puede conservarse: autorización, token, aislamiento, temporalidad, atomicidad, UI y cron están correctamente estructurados. La remediación se limita principalmente al serializador seguro, columnas faltantes y pruebas de regresión correspondientes.

## Constancia de auditoría

Durante esta revisión no se modificó código de aplicación, no se desplegaron funciones, no se hizo `git push`, no se generaron o consumieron exportaciones, no se ejecutaron logins ni mutaciones, no se alteraron datos o variables y no se realizaron acciones en Linear.

Se efectuaron únicamente lecturas de Git y archivos locales, verificaciones locales sin mutación funcional, consultas de solo lectura a Railway y a la especificación productiva de Convex, revisión de documentación oficial y la creación de esta acta dentro de `tmp/`.
