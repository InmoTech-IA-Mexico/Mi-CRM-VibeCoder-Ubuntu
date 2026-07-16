# Acta de auditoría — Etiquetas de producto (JUA-36) · v2

Fecha: 2026-07-15  
Commits auditados: `8b153b8` + `6af3964`  
Base anterior: `8032984`  
Estado corroborado: **desplegado en Convex y Railway; frontend productivo disponible**  
Referencia: dictamen v1 = **GO CON OBSERVACIONES NO BLOQUEANTES**  
Veredicto v2: **CIERRE RATIFICADO — GO POST-DESPLIEGUE CON PRECISIONES DOCUMENTALES NO BLOQUEANTES**

---

## Resultado del dictamen

Se ratifica el cierre productivo de JUA-36 sobre `6af3964`.

No se encontraron regresiones de código ni incumplimientos funcionales, de autorización, aislamiento por negocio o compatibilidad que requieran rollback o reapertura de la entrega.

La OBS-1 quedó resuelta en código. Las OBS-2/3 quedaron resueltas en su objetivo funcional de mejorar el driver. La OBS-4 conserva respaldo estático suficiente y cuenta con la ejecución negativa declarada. La OBS-5 permanece correctamente registrada como mejora futura.

Las precisiones pendientes se limitan a documentación y conservación de evidencia; no alteran el veredicto productivo.

## Integridad del delta

- `6af3964` es hijo directo de `8b153b8`.
- El delta contiene exactamente dos archivos y tres líneas añadidas.
- Los únicos cambios son:
  - `aria-pressed={activa}` en la multiselección de la ficha.
  - `aria-pressed={chip === c.key}` en los filtros fijos.
  - `aria-pressed={chip === key}` en los filtros dinámicos de etiqueta.
- `git diff --check 8b153b8..6af3964` no reportó errores.
- `HEAD`, `main` y `origin/main` apuntaban a `6af3964` durante la auditoría.
- El árbol se encontraba limpio antes de generar esta acta.
- Se ejecutaron nuevamente `npx tsc --noEmit` y `npx eslint .`; ambos terminaron con código 0.

## Corroboración independiente de producción

### Railway

La consulta en vivo a Railway devolvió:

- Deployment: `cdecd571-95a2-42f0-93e1-5f1d0a7d7ebb`.
- Estado: `SUCCESS`.
- Rama: `main`.
- Commit completo: `6af39641bea1d847a8ea48cead1cd6514720bf11`.
- Build configurado: `npm run build`.
- Healthcheck: `/login`.

La URL productiva `https://mi-crm-vibecoder-ubuntu-production.up.railway.app/login` respondió HTTP 200 durante esta auditoría.

### Convex

`npx convex function-spec --prod` terminó con código 0 y confirmó el deployment:

`https://glad-bird-297.convex.cloud`

La especificación productiva contiene:

- La tabla `etiquetas`.
- `clientes:cambiarEtiquetas`.
- `etiquetas:listar`.
- `etiquetas:crear`.
- `etiquetas:renombrar`.
- `etiquetas:eliminar`.

Esto corrobora que el backend requerido por JUA-36 está presente en producción. La especificación de Convex no expone un hash Git, por lo que acredita las firmas desplegadas, no la identidad exacta del commit de backend.

### Linear

El estado **Done** y el comentario de cierre constan en el acta de producción y en `tmp/estado-produccion.md`. No se localizó una respuesta API, exportación o captura nueva de JUA-36 que permita corroborarlos de forma independiente desde la evidencia preservada en el workspace.

Esta limitación es documental y no afecta el estado técnico de la entrega.

## Revisión de observaciones del dictamen v1

### OBS-1 — Estado seleccionado accesible

**Estado: RESUELTA.**

Los tres grupos señalados por el dictamen exponen ahora un booleano `aria-pressed` coherente con el estado visual:

- Opciones de la multiselección en la ficha.
- Chips fijos de estado y prioridad.
- Chips dinámicos de etiqueta.

La implementación satisface exactamente la acción sugerida y no modifica la lógica de selección.

### OBS-2 — Reproducibilidad del driver

**Estado: RESUELTA EN EL FLUJO NORMAL, con precisión sobre conservación y limpieza.**

El driver v2:

- Genera nombres con sufijo configurable.
- No depende de `Consultoría` frente a `Consultoría Premium`.
- Elimina las dos etiquetas QA al completar el recorrido.
- Preserva cualquier etiqueta previa del cliente porque la hoja parte del conjunto asignado y solo alterna las dos etiquetas QA.
- Pasa la comprobación sintáctica de Node.

Persisten tres límites no bloqueantes:

1. El sufijo automático tiene resolución de un segundo; dos corridas simultáneas o con el mismo sufijo todavía pueden colisionar.
2. La limpieza ocurre únicamente si el script alcanza el paso 9. Una excepción de Playwright anterior no entra en un bloque `finally` de saneamiento.
3. Driver y capturas continúan dentro de `tmp/`, directorio ignorado por Git; sin archivo externo, no son evidencia durable.

**Sugerencia:** usar un sufijo aleatorio o UUID, y ejecutar la limpieza mediante `try/finally` o una rutina independiente que pueda recuperarse de una corrida interrumpida.

### OBS-3 — Vigilancia de errores del navegador

**Estado: RESUELTA PARA `pageerror` Y `console.error`.**

Cada página creada por el driver se registra inmediatamente con el vigilante. Los errores no esperados se acumulan y convierten la corrida en fallo.

La excepción productiva está acotada a patrones relacionados con `etiquetas:crear`, la única mutación que el escenario rechaza intencionalmente. La incidencia de la primera corrida es compatible con el comportamiento documentado del cliente de Convex en producción.

La captura `d12-gestion.png` conserva el indicador de desarrollo “2 Issues”; corresponde a la corrida dev con el rechazo provocado. El driver final permite distinguirlo de errores no esperados, aunque no se preservó el reporte textual de la corrida productiva.

Como mejora adicional, podría vigilarse también `requestfailed` si se desea que fallos de recursos o red no reflejados en consola invaliden la prueba.

### OBS-4 — Pruebas negativas de servidor

**Estado: SUFICIENTEMENTE CERRADA, con evidencia de ejecución no preservada.**

La ejecución declarada cubre:

- `crear`, `renombrar` y `eliminar` con sesión operativa: rechazo “No autorizado”.
- Asignación de una etiqueta eliminada: rechazo “Etiqueta no válida”.

No se encontró script o transcripción separada de esos cuatro resultados. La revisión estática del dictamen v1 ya confirmó las mismas defensas en servidor:

- Las tres mutaciones administrativas exigen rol `admin`.
- `cambiarEtiquetas` exige que cada etiqueta exista y comparta el negocio de la sesión.

La ausencia de un segundo negocio en dev justifica no repetir dinámicamente el caso cross-negocio; la defensa está en el mismo condicional que valida existencia y pertenencia.

### OBS-5 — Escalabilidad

**Estado: REGISTRADA Y ACEPTADA COMO MEJORA FUTURA.**

No se requiere cambio para el volumen actual. Antes de crecer de forma relevante deberán evaluarse asignaciones normalizadas o contadores transaccionales y decidirse la semántica de `clientes.actualizadoEn` durante la limpieza masiva.

## Evidencia funcional revisada

El driver v2 contiene 18 comprobaciones funcionales explícitas más la comprobación global de ausencia de errores inesperados, coherente con el resumen **19/19**.

Las capturas `d12-gestion.png`, `d12-ficha.png` y `d12-lista.png` muestran:

- Dos etiquetas QA con sufijo y el rechazo del duplicado.
- Ambas etiquetas asignadas a Ana García.
- Filtro por etiqueta con conteo 1 y una sola tarjeta visible.

Las imágenes conservadas corresponden a una corrida de desarrollo —el sufijo visible es `dev1` y aparece el toolbar de Next—, no constituyen capturas de la segunda corrida productiva.

El driver sí comprueba en producción declarada:

- Carga de lista y ficha.
- Creación y rechazo de duplicado.
- Asignación múltiple.
- Filtro y combinación con búsqueda.
- Facultades del operativo y guard de ruta.
- Renombrado conservando la asignación en la ficha.
- Eliminación limpiando catálogo y ficha.
- Limpieza de las dos etiquetas QA.

## Precisiones documentales pendientes

### DOC-1 — `estado-produccion.md` contiene hashes contradictorios

El encabezado y la entrega más reciente indican correctamente `6af3964`, pero la tabla de infraestructura todavía afirma:

- Railway en `commitHash 2cc9d44`.
- `origin/main = 2cc9d44`.

La consulta viva a Railway y Git confirma que ambos valores actuales son `6af3964`. Deben corregirse esas dos filas para que el documento no se contradiga.

### DOC-2 — El acta productiva atribuye dos aserciones que el driver no ejecuta

El texto v2 afirma que:

- Después de renombrar se conserva la asignación “en ficha y filtro”.
- Después de eliminar desaparece de “catálogo, ficha y filtro”.

El driver final comprueba ficha y catálogo, pero no vuelve a la lista para verificar el filtro después de los pasos 7 y 8.

La implementación por identificador y la desaparición reactiva del catálogo respaldan estáticamente ambos comportamientos, por lo que no hay un defecto funcional conocido. Para precisión, el acta debe limitar esas frases a lo realmente ejercitado o el driver debe añadir las dos aserciones.

### DOC-3 — Falta reporte durable de las corridas finales

No se preservó stdout, reporte Playwright o JSON de:

- Los 19/19 de dev.
- Los 19/19 de producción.
- Las cuatro negativas directas de servidor.

Las capturas y el código del driver respaldan parcialmente el relato, pero no acreditan por sí solos el resultado final de cada ejecución.

**Sugerencia:** guardar un reporte con fecha, base URL, sufijo, conteos y errores observados, omitiendo tokens y contraseñas, dentro del archivo formal de cierre.

## Dictamen de cierre

JUA-36 puede permanecer **Done** y `6af3964` puede permanecer en producción.

No se requiere rollback, hotfix ni reapertura funcional. Se recomienda únicamente:

1. Corregir las dos filas antiguas de `tmp/estado-produccion.md`.
2. Precisar la cobertura real de los pasos 7 y 8.
3. Mejorar en futuras corridas la limpieza ante excepciones y la conservación del reporte.

## Constancia de auditoría

Durante esta revisión no se modificó código, no se desplegaron funciones, no se hizo `git push`, no se alteraron datos de desarrollo o producción y no se realizaron acciones en Linear. Se efectuaron únicamente consultas de lectura a Git, Railway, Convex y la URL pública, verificaciones locales sin mutación funcional y la creación de esta acta dentro de `tmp/`.
