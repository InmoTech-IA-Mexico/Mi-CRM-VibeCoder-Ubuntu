# Acta — Exportación de datos (JUA-44) · v2 (remediación del NO-GO v1)

Fecha: 2026-07-16
Commits candidatos: `4108c0d` (base) + `d951ac6` (remedia B-1/B-2)
Parent real de la serie: `66a36f8` (corrección al acta v1, que decía `4b72f65`; el delta
`4b72f65..66a36f8` es solo evidencia de auditoría de JUA-125, sin cambio de app funcional `0a66abb`).
Estado: construido y verificado en local + dev de Convex. **NO desplegado.**
Referencia: dictamen v1 = **NO-GO** (B-1 CSV injection; B-2 campos omitidos).
Veredicto: **PENDIENTE DE DICTAMEN**

--------------------------------------------------------------------

## B-1 (BLOQUEANTE) — CSV / formula injection → RESUELTO (`d951ac6`)

`csvCampo` ahora distingue tipo y neutraliza:
- **Números** (p. ej. `monto`) → se serializan tal cual (no son texto de usuario; un `-500` queda
  como número negativo real, sin corromper).
- **Texto** → si empieza con un iniciador de fórmula (`= + - @`, sus variantes de ancho completo
  `＝＋－＠`, o tab/CR/LF), se prefija con **apóstrofo** (la hoja de cálculo lo trata como "texto" y
  no lo muestra) **antes** del escape RFC 4180.

Compromiso documentado (no hay estrategia idéntica para todos los lectores CSV): apóstrofo de
prefijo. Aplicado uniformemente a los 4 CSV, sobre todos los campos string (nombres, teléfonos,
email, empresa, cargo, dirección, observaciones, etiquetas, descripciones, resultados, comentarios,
motivos, títulos…).

**Verificado con fixtures maliciosos (driver 17, dev):**
- Nombre `=1+1 …` → `'=1+1 …` · teléfono `+52 …` → `'+52 …` · oportunidad `@Oportunidad,"fx"` →
  `'@Oportunidad` (y la coma+comillas escapadas RFC 4180: `"'@Oportunidad, QA ""fx"""`) · comentario
  `-Comentario…` → `'-Comentario…`.
- **Monto `-500` (number) intacto, sin apóstrofo** (los teléfonos `+52` sí se conservan legibles
  como texto — el criterio del dictamen).

--------------------------------------------------------------------

## B-2 (BLOQUEANTE) — Campos persistidos omitidos → RESUELTO (`d951ac6`)

- **oportunidades.csv** añade **Comentarios** y **Actualizada por** (resuelto a nombre, como el
  resto de referencias).
- **recordatorios.csv** añade **Oportunidad** (vinculada, resuelta a nombre — se usa el mapa
  `nombreOpo` que antes quedaba sin usar), **Fecha fin**, **Día de recurrencia** y **Creado** (por
  consistencia con clientes/oportunidades).

**Matriz de decisión de columnas** (los IDs internos se omiten; las referencias resueltas bastan):
- `clientes`: todos los campos exportados; `etiquetaIds` → nombres; papelera marcada.
- `notas`: todos; `clienteId`/`autorId` → nombres.
- `oportunidades`: todos los de negocio; `clienteId`/`responsableId`/`actualizadoPor` → nombres.
- `seguimientos`: todos los de negocio; `clienteId`/`empleadoId`/`oportunidadId`/`responsableId` →
  nombres; `diaRecurrencia` como número. (`ventas` no forma parte de los 4 conjuntos de JUA-44.)

**Verificado (driver 17):** con una oportunidad con comentarios + cambio de etapa, la fila trae los
comentarios y "Actualizada por = Marta Ruiz"; con un recordatorio recurrente vinculado, la fila trae
la oportunidad, día 15 y fecha fin.

--------------------------------------------------------------------

## Observaciones no bloqueantes del dictamen v1

- **OBS-3 (CSV de QA en disco) → RESUELTO:** el driver 16 descarga a un **directorio temporal fuera
  del árbol de evidencia** (`os.tmpdir()`) y lo borra en `finally`. Verificado: 0 `dl-*.csv` tras la
  corrida. (Los `dl-*.csv` residuales de la corrida v1 se eliminaron.)
- **OBS-4 (durabilidad de pruebas de servidor) → RESUELTO:** el driver 17 conserva un reporte
  sanitizado (`reporte-export-fixtures-dev.txt`) que valida cabeceras y contenido de los CSV, no
  solo de clientes.
- **Cleanup reportado (lección OBS-2 de JUA-125):** el driver 17 registra `cleanup: PASS/FAIL` y
  borra sus fixtures (cliente + oportunidad + recordatorio); verificado 0 residual QA-fx en dev.
- **OBS-1 (token en query string), OBS-2/OBS-5 (escalabilidad de `consumir`/`purgar`):** registradas
  como mejora futura (ver más abajo); no bloqueantes al volumen actual.

--------------------------------------------------------------------

## Verificación (0 errores)

```txt
npx tsc --noEmit   OK      npm run build          OK (rutas /exportar y /exportar-datos)
npx eslint .       OK      npx convex dev --once  OK
```

- **Driver 17 — fixtures B-1/B-2 (dev): 11/11 PASS** (6 de inyección/escape + 4 de completitud +
  cleanup). Reporte durable sin secretos.
- **Driver 16 — UI E2E (dev): 12/12 PASS + sin errores de navegador** (operativo sin acceso; admin
  genera; 4 CSV descargados; un solo uso; botones de respaldo tras consumir). CSV de QA en dir
  temporal, borrado al terminar.

--------------------------------------------------------------------

## Mejora futura registrada (no bloqueante)

Se propondrá como issue de hardening (continuación de JUA-125): OBS-1 (token en fragmento `#` en vez
de query string + `Referrer-Policy`/`noindex` para `/exportar`), OBS-2/OBS-5 (paginar/batchear
`consumir` y `purgar`, e índice por `expiraEn`, antes de crecer el volumen de negocios).

--------------------------------------------------------------------

## Cobertura frente a los criterios del NO-GO

1 ✔ defensa documentada contra formula injection · 2 ✔ pruebas con `= + - @`, coma y comillas ·
3 ✔ oportunidades.csv con comentarios y último autor · 4 ✔ recordatorios.csv con oportunidad, fecha
fin y día · 5 ✔ el driver valida fixtures no vacíos de oportunidades y recordatorios · 6 ✔ auth
admin/operativo, un solo uso, regeneración, descarga 4/4 y respaldo (driver 16) · 7 ✔ tsc/eslint/
build/convex en 0 · 8 ✔ CSV de QA eliminados antes de archivar.

## Si el dictamen es GO

`npx convex deploy` (funciones + schema aditivo + cron, ANTES del frontend) → `git push` → Railway →
verificación en vivo (fixtures de fórmula + descarga con la cuenta admin de prod, y limpieza) →
JUA-44 Done + comentario → evidencia a `auditorias/` (escaneo de secretos y de `dl-*.csv`) →
`tmp/estado-produccion.md`.
