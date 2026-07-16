# Acta — Etiquetas de producto (JUA-36) · v2 (obs. aplicadas + DESPLEGADO Y VERIFICADO EN VIVO)

Fecha: 2026-07-15
Commits: `8b153b8` (GO del dictamen v1) + `6af3964` (aplica OBS-1)
Referencia: dictamen v1 = **GO CON OBSERVACIONES NO BLOQUEANTES** con luz verde explícita.
Estado: **EN PRODUCCIÓN** (Convex `glad-bird-297` + Railway SUCCESS con `commitHash 6af3964`).
JUA-36 marcada **Done** en Linear con comentario de cierre.

--------------------------------------------------------------------

## Observaciones aplicadas

**OBS-1 — aria-pressed → RESUELTA (`6af3964`, +3 líneas)**
Los botones de multiselección de la hoja de la ficha y TODOS los chips de filtro de la lista (fijos
de estado/prioridad y dinámicos de etiqueta) exponen `aria-pressed` con su estado.

**OBS-2 — Driver no reproducible → RESUELTA (sin código de app)**
Driver v2 (`tmp/drivers-jua36/driver-12-etiquetas-v2.js`): nombres **únicos por corrida** (sufijo
parametrizable), sin dependencia del residuo previo, y **se limpia a sí mismo** (paso 9 elimina sus
datos QA). Estructura calcada a los pasos 2–9 de la verificación productiva del dictamen. El v1
queda archivado como evidencia histórica.

**OBS-3 — Vigilancia de errores del navegador → RESUELTA (driver v2)**
El driver escucha `pageerror` y `console.error` en TODAS las páginas (admin y operativo) y **falla**
ante cualquier error no incluido en la lista explícita de esperados (solo el rechazo de duplicado
del paso 3 y su registro). Corrida en dev: **19/19 PASS + "sin pageerror ni console.error
inesperados en toda la corrida"**.

**OBS-4 — Pruebas negativas de servidor → EJECUTADAS (dev, 4/4)**
Invocación directa de las mutaciones con sesión REAL de Carlos (operativo):
`etiquetas.crear` / `renombrar` / `eliminar` → **"No autorizado"** las tres. Y
`clientes.cambiarEtiquetas` con el id de una etiqueta **eliminada** → **"Etiqueta no válida"**.
(El caso "etiqueta de otro negocio" no es ejercitable en dev — solo existe el negocio demo — y el
dictamen ya validó estáticamente esa defensa; queda cubierto por el mismo check de pertenencia.)

**OBS-5 — Escalabilidad de conteos/eliminación → REGISTRADA, sin cambio (aprobado en v1)**
Anotada como mejora futura junto a la OBS-2 de JUA-37: si crece el volumen, tabla de asignaciones
normalizada (índices por etiqueta/cliente) o contadores transaccionales, y decidir si la limpieza
automática debe tocar `clientes.actualizadoEn`.

--------------------------------------------------------------------

## Re-verificación (0 errores)

```txt
npx tsc --noEmit   OK
npx eslint .       OK
Driver v2 (dev)    19/19 PASS + corrida libre de errores de navegador
Negativas servidor 4/4 (rol operativo rechazado ×3 · etiqueta eliminada rechazada)
```

Capturas nuevas en `tmp/capturas-jua36/` (d12-gestion, d12-ficha, d12-lista).

--------------------------------------------------------------------

## Despliegue ejecutado (con la luz verde del dictamen v1)

1. `npx convex deploy` (schema aditivo + funciones nuevas, ANTES del frontend) → OK.
2. `git push` → Railway construyó y quedó en **SUCCESS con `commitHash 6af3964`**.

## Verificación en producción — los 9 pasos del dictamen, con el driver v2

**Resultado final: 19/19 PASS + "sin pageerror ni console.error inesperados en toda la corrida".**

- Paso 2: clientes existentes sin etiquetas listan y abren con normalidad.
- Paso 3: 2 etiquetas QA creadas; duplicado con DISTINTA capitalización rechazado con motivo
  visible ("Ya existe una etiqueta con ese nombre" — el `ConvexError` llega en prod).
- Pasos 4–5: chips en la ficha; filtro deja exactamente 1 cliente; combinable con el buscador.
- Paso 6: operativo asigna/quita pero no ve la creación; `/etiquetas` le redirige a `/inicio`.
  (Las mutaciones admin invocadas DIRECTAS con sesión operativa ya quedaron rechazadas 4/4 en dev.)
- Paso 7: renombrar una etiqueta ASIGNADA conserva la asignación en ficha y filtro (por id).
- Paso 8: eliminar la etiqueta asignada la limpia de catálogo, ficha y filtro; confirmación avisa
  del alcance ("se quitará de 1 cliente").
- Paso 9: datos QA autolimpiados por el driver → **el catálogo de prod quedó sin residuo**.

**Incidencia del vigilante (transparencia, sin impacto funcional):** en la 1.ª corrida el watcher
de OBS-3 marcó 1 `console.error` no listado: en producción el cliente de Convex loguea el rechazo
ESPERADO del duplicado como `[CONVEX M(etiquetas:crear)] … Server Error` (mensaje enmascarado,
distinto del texto que emite en dev). La UI sí mostró el motivo real (PASS del paso 3). Se amplió
la lista de esperados SOLO a esa mutación (la única que el driver rechaza a propósito) y la 2.ª
corrida completa quedó limpia. Driver final: `tmp/drivers-jua36/driver-12-etiquetas-v2.js`.

## Cierre

JUA-36 → **Done** en Linear con comentario (funcionalidad, obs. aplicadas, verificación).
`tmp/estado-produccion.md` actualizado (prod = `6af3964`). OBS-5 registrada como mejora futura.
Capturas d12-* en `tmp/capturas-jua36/`.

--------------------------------------------------------------------

# ADENDA — Dictamen v2 recibido: CIERRE RATIFICADO · precisiones DOC aplicadas (2026-07-15)

El dictamen v2 ratificó el cierre productivo de `6af3964` sin rollback ni reapertura, con tres
precisiones documentales. Las tres quedaron aplicadas:

**DOC-1 — Hashes contradictorios en `estado-produccion.md` → CORREGIDO.** Las dos filas de la tabla
de infraestructura (Railway commitHash y `origin/main`) que aún decían `2cc9d44` ahora dicen
`6af3964`, coherentes con el encabezado.

**DOC-2 — Cobertura real de los pasos 7 y 8 → CERRADO CON EJECUCIÓN, no con recorte de texto.**
Driver **v3** (`tmp/drivers-jua36/driver-13-etiquetas-v3.js`) añade las dos aserciones que faltaban
y se ejecutó **contra producción**: tras renombrar, el FILTRO de la lista muestra el chip con el
nombre nuevo y filtrar por él conserva la asignación (7b); tras eliminar, el filtro ya no ofrece la
etiqueta (8c). Resultado: **22/22 PASS + corrida libre de errores de navegador**, datos QA
autolimpiados.

**DOC-3 — Reporte durable → RESUELTO.** El driver v3 escribe un reporte con fecha, base URL, sufijo,
resultados y errores observados (sin tokens): `tmp/drivers-jua36/reporte-etiquetas-v3-prod.txt`
(corrida productiva 22/22). Las 4 negativas de servidor se re-ejecutaron con transcripción durable:
`tmp/drivers-jua36/reporte-negativas-servidor.txt` (4/4 rechazos correctos).

**Sugerencias de OBS-2/3 del dictamen v2 también incorporadas al v3:** sufijo aleatorio (sin
colisiones), limpieza en `finally` que barre las etiquetas QA en cualquier estado intermedio si la
corrida se interrumpe, y registro informativo de `requestfailed` en el reporte.

**Transparencia:** la primera corrida del v3 en prod tuvo 1 falso negativo de sincronización (la
aserción de la ficha del paso 7 usaba `isVisible()` instantáneo y la carga en prod superó la pausa
fija; los chequeos 7b de la MISMA corrida y el aviso "se quitará de 1 cliente" del paso 8 probaron
que la asignación sí estaba conservada). Se corrigió con esperas explícitas (`waitFor`) en las
aserciones positivas post-navegación y la segunda corrida quedó 22/22 limpia. Ambos detalles constan
en el reporte y en esta adenda.
