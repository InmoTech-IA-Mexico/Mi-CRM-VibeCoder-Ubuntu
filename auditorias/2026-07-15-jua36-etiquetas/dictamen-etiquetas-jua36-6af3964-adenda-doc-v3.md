# Acta de auditoría — Seguimiento de adenda JUA-36 · v3

Fecha: 2026-07-15  
Commit productivo: `6af3964`  
Referencia: dictamen v2 = **CIERRE RATIFICADO — GO POST-DESPLIEGUE**  
Objeto: revisión de la adenda DOC-1/2/3 y del driver v3  
Veredicto: **ADENDA ACEPTADA — JUA-36 PERMANECE CERRADA, CON UNA PRECISIÓN DE CONSERVACIÓN NO BLOQUEANTE**

---

## Resultado

Se acepta la adenda de cierre de JUA-36.

- **DOC-1 está resuelta.** `tmp/estado-produccion.md` ya contiene `6af3964` tanto en el encabezado como en las filas de Railway y repositorio.
- **DOC-2 está resuelta.** El driver v3 incorpora y acredita las comprobaciones de filtro posteriores al renombrado y a la eliminación.
- **DOC-3 está resuelta como trazabilidad local**, pero los archivos no son todavía evidencia durable fuera de este workspace porque permanecen dentro de `tmp/`, ignorado por Git.

No se encontró ningún motivo para rollback, hotfix o reapertura funcional. JUA-36 puede permanecer **Done** y `6af3964` puede permanecer en producción.

## Estado y producción reconfirmados

- `HEAD`, `main` y `origin/main` apuntan a `6af3964`.
- El árbol de trabajo se encontraba limpio antes de generar esta acta.
- Railway volvió a reportar:
  - Deployment `cdecd571-95a2-42f0-93e1-5f1d0a7d7ebb`.
  - Estado `SUCCESS`.
  - Rama `main`.
  - Commit completo `6af39641bea1d847a8ea48cead1cd6514720bf11`.
- Convex producción `glad-bird-297` continúa exponiendo la tabla `etiquetas`, `clientes:cambiarEtiquetas` y las cuatro operaciones del catálogo.
- La URL productiva `/login` respondió HTTP 200 durante esta revisión.

## DOC-1 — Estado de producción

**Estado: RESUELTA.**

Las dos filas contradictorias señaladas por el dictamen v2 ahora indican:

- Railway `commitHash 6af3964`.
- `origin/main = 6af3964`.

Son coherentes con Git y con la consulta viva a Railway.

## DOC-2 — Cobertura de los pasos 7 y 8

**Estado: RESUELTA CON EJECUCIÓN.**

El driver `driver-13-etiquetas-v3.js` añade tres comprobaciones funcionales:

1. Después de renombrar, el chip de filtro aparece con el nombre nuevo.
2. Filtrar por la etiqueta renombrada conserva exactamente un cliente.
3. Después de eliminar, el filtro deja de ofrecer la etiqueta.

El script contiene 21 llamadas funcionales a `ok` y una comprobación global de errores inesperados, consistente con **22 PASS / 0 FAIL**.

El reporte productivo preservado confirma expresamente los PASS 7b y 8c. Por tanto, las frases “en ficha y filtro” y “catálogo, ficha y filtro” ya están respaldadas por la corrida final.

## Driver v3 — mejoras técnicas

### Sufijo QA

El sufijo aleatorio de seis caracteres base 36 reduce la probabilidad de colisión a un nivel despreciable para estas corridas y elimina la dependencia del segundo del reloj.

La formulación estricta “sin colisiones” debe entenderse como riesgo práctico muy bajo, no imposibilidad matemática.

### Limpieza en `finally`

La limpieza se ejecuta al salir del flujo principal tanto si este termina normalmente como si lanza una excepción dentro del `try`.

Busca y elimina las tres formas posibles de los nombres de esta corrida:

- Etiqueta original 1.
- Etiqueta 1 renombrada.
- Etiqueta 2.

Cada eliminación está aislada con `try/catch`, por lo que un fallo de una no impide intentar las siguientes ni tapa la excepción original.

La limpieza es de mejor esfuerzo: si la página o sesión administrativa dejan de ser utilizables, los errores se silencian y podría quedar residuo. Es una limitación razonable para un driver UI, aunque una rutina de saneamiento de servidor sería más fuerte.

### Sincronización

El helper `visible()` usa `waitFor({ state: "visible", timeout: 15000 })` en las aserciones positivas sensibles después de navegar. La corrección aborda adecuadamente el falso negativo de la primera corrida productiva.

### Vigilancia del navegador

La corrida final registró:

- `pageerror` inesperados: 0.
- `console.error` inesperados: 0.
- `requestfailed`: 65, informativos y no bloqueantes.

Las primeras diez solicitudes guardadas son abortos `net::ERR_ABORTED` de peticiones RSC durante navegación/prefetch de Next. No contradicen los 22 PASS, pero hacen recomendable usar la frase precisa **“sin pageerror ni console.error inesperados”** en vez de “libre de errores de navegador” sin matiz.

Si se desea convertir `requestfailed` en señal accionable, conviene clasificar o excluir los abortos de navegación esperados y destacar únicamente fallos de red reales.

## DOC-3 — Reportes preservados

### Reporte productivo

`reporte-etiquetas-v3-prod.txt` contiene:

- Fecha ISO.
- Base URL productiva.
- Cliente y sufijo QA.
- 22 PASS / 0 FAIL.
- Lista completa de resultados.
- Cero errores inesperados de página o consola.
- Conteo y muestra de `requestfailed`.

No contiene tokens ni contraseñas.

### Reporte de negativas

`reporte-negativas-servidor.txt` registra nuevamente:

- `crear`, `renombrar` y `eliminar` rechazadas con una sesión operativa.
- Asignación de una etiqueta eliminada rechazada como “Etiqueta no válida”.
- Deployment dev, fecha y fixtures, con tokens omitidos.

La transcripción es coherente con las defensas de servidor ya verificadas estáticamente.

### Precisión pendiente de conservación

Los dos reportes, los drivers y las capturas se encuentran bajo `/tmp/` del proyecto y `.gitignore` excluye `/tmp/`. Por ello:

- Persisten en este workspace actual.
- No viajan en un clon nuevo del repositorio.
- Pueden perderse por limpieza local o reemplazo del entorno.

Además, el único reporte v3 actualmente localizado corresponde a la segunda corrida exitosa. El falso negativo de la primera corrida está explicado en la adenda archivada, pero no existe un reporte separado de esa ejecución.

Finalmente, si el flujo lanza una excepción, el `finally` intenta limpiar, pero la excepción se propaga después y omite las líneas posteriores que escriben el reporte. Por tanto, el driver garantiza mejor el saneamiento que la generación de reporte ante una interrupción excepcional.

**Sugerencia:** para cerrar DOC-3 en sentido durable, incorporar los reportes sanitizados al archivo formal/versionado o a un almacenamiento externo persistente. Si se desea reportar también excepciones, envolver el flujo con `catch`, conservar el error, escribir el reporte después de `finally` y devolver el código de salida correspondiente.

## Sobre la primera corrida productiva

La adenda archivada documenta el falso negativo de sincronización y la corrección aplicada. El reporte actual acredita únicamente la segunda corrida de 22/22.

La explicación técnica es consistente con el código y no revela un defecto del producto: las comprobaciones posteriores de la primera corrida indicaron que la asignación seguía existiendo, y el cambio final sustituyó la lectura instantánea por una espera explícita.

## Dictamen final

Se ratifica sin cambios el cierre productivo:

- JUA-36 permanece **Done**.
- `6af3964` permanece en producción.
- DOC-1 y DOC-2 quedan cerradas.
- DOC-3 queda cerrada como evidencia local y pendiente únicamente de conservación durable fuera de `tmp/`.
- OBS-5 continúa como mejora futura de escalabilidad.

No se requiere ninguna acción funcional inmediata.

## Constancia de auditoría

Durante esta revisión no se modificó código, no se desplegaron funciones, no se hizo `git push`, no se alteraron datos de desarrollo o producción y no se realizaron acciones en Linear. Se efectuaron únicamente consultas de lectura, inspección de archivos y la creación de esta acta dentro de `tmp/`.
