# Acta de auditoría — Etiquetas de producto (JUA-36) · v1

Fecha: 2026-07-15  
Commit auditado: `8b153b8`  
Base productiva declarada: `8032984`  
Estado al auditar: construido y verificado en local + desarrollo de Convex. **No desplegado.**  
Veredicto: **GO CON OBSERVACIONES NO BLOQUEANTES**

---

## Resultado del dictamen

No se encontraron defectos funcionales, de autorización, aislamiento entre negocios, integridad de referencias o compatibilidad de schema que bloqueen el paso a producción de `8b153b8`.

Se concede **luz verde explícita para que el responsable autorizado ejecute el despliegue**, respetando el orden Convex antes que Railway y realizando después la verificación productiva indicada en esta acta.

## Integridad y alcance revisados

- `8b153b8` es hijo directo de `8032984`.
- `origin/main` apuntaba a `8032984` al momento de la revisión.
- El árbol de trabajo se encontraba limpio antes de generar esta acta.
- El diff contiene exactamente los 10 archivos declarados y coincide con `+757/−12`.
- `git diff --check 8032984..8b153b8` no reportó errores.
- `convex/_generated/api.d.ts` incorpora correctamente el módulo nuevo `etiquetas`.
- Se ejecutaron de forma independiente `npx tsc --noEmit` y `npx eslint .`; ambos terminaron con código 0.
- No se repitió `npx convex dev --once` ni el driver funcional, para no alterar datos del entorno de desarrollo. La evidencia aportada de esas ejecuciones fue revisada estática y visualmente.

## Revisión de seguridad y aislamiento

### Lectura y catálogo

`etiquetas.listar` obtiene el negocio exclusivamente desde la sesión y limita por el índice `por_negocio`. Ambos roles pueden consultar el catálogo porque lo necesitan para asignar y filtrar.

`crear`, `renombrar` y `eliminar` exigen rol `admin` en el servidor. El guard cliente de `/etiquetas` mejora la navegación, pero la seguridad no depende de él.

En renombrado y eliminación se comprueba además que la etiqueta pertenezca al mismo negocio de la sesión. Una etiqueta ajena se trata como no encontrada.

### Asignación a clientes

`clientes.cambiarEtiquetas`:

- Resuelve el negocio desde la sesión.
- Rechaza clientes inexistentes, de otro negocio o en papelera.
- Deduplica los identificadores recibidos.
- Valida que cada etiqueta exista y pertenezca al mismo negocio.
- Reemplaza el conjunto completo y actualiza `actualizadoEn`.
- No modifica `ultimaInteraccion`, de acuerdo con el alcance.

No se identificó una vía pública para asignar a un cliente una etiqueta de otro negocio.

## Integridad de datos

La tabla `etiquetas` y el campo opcional `clientes.etiquetaIds` constituyen un cambio aditivo. Los clientes existentes sin el campo continúan funcionando mediante los respaldos `?? []`.

La eliminación del catálogo recorre los clientes del negocio, quita la referencia de todos los que la contengan —incluidos los que estén en papelera— y después elimina la etiqueta. Todo sucede dentro de una sola mutación de Convex, por lo que no quedan referencias huérfanas si la transacción concluye.

La unicidad del nombre se comprueba por negocio después de normalizar espacios y sin distinguir mayúsculas. Las lecturas y escrituras ocurren en la misma transacción de Convex, por lo que las creaciones o renombrados concurrentes quedan sujetos a su control de conflictos y reintentos.

## Revisión funcional

### Ficha del cliente

- Las etiquetas asignadas se resuelven a nombre, se ordenan y se muestran como chips.
- La hoja permite multiselección y reemplaza el conjunto al guardar.
- Ambos roles pueden asignar y quitar.
- El administrador puede crear una etiqueta al vuelo; la nueva etiqueta se autoselecciona.
- El enlace a la gestión completa solo aparece para administrador.

### Lista y filtro

- Los chips dinámicos se construyen a partir del catálogo del negocio.
- Cada chip muestra el conteo de clientes fuera de papelera.
- El filtro compara por identificador, no por nombre, por lo que un renombrado no rompe las asignaciones.
- La selección es única y se combina correctamente con la búsqueda textual.

### Gestión administrativa

- El acceso se añade al Perfil únicamente para administradores.
- La ruta aplica el guard cliente ya usado por otras pantallas administrativas.
- Crear, renombrar y eliminar consumen mutaciones protegidas en servidor.
- Los errores de validación de nombre llegan mediante `ConvexError` y se presentan al usuario.
- La eliminación usa confirmación destructiva e informa el número de clientes activos afectados.

## Evidencia revisada

El driver `tmp/drivers-jua36/driver-11-etiquetas.js`:

- Existe y pasa `node --check`.
- Contiene 16 comprobaciones explícitas.
- Cubre administración, asignación múltiple, filtro combinado con búsqueda, facultades del operativo, guard de ruta y limpieza al eliminar.

Se revisaron las tres capturas de 390×844:

- `d11-gestion-etiquetas.png`: catálogo, renombrado y mensaje de duplicado.
- `d11-ficha-chips.png`: dos etiquetas visibles en la ficha de Ana García.
- `d11-lista-filtro.png`: chip activo, conteo 1 y una sola tarjeta visible.

La evidencia es coherente con los flujos declarados. Los huecos de conservación y observabilidad del driver se registran abajo como no bloqueantes.

## Decisiones de alcance aprobadas

Se aprueban para esta liberación:

1. Permitir que ambos roles asignen o quiten etiquetas y reservar la administración del catálogo al rol admin.
2. Usar selección única en el filtro de lista.
3. Iniciar sin catálogo semilla.
4. No mostrar etiquetas en cada tarjeta de la lista.
5. Mantener las etiquetas fuera de `src/lib/enums.ts`, al ser datos configurables por negocio.
6. Excluir clientes en papelera de los conteos de segmentación, aunque la eliminación del catálogo también limpie sus referencias.

## Observaciones no bloqueantes

### OBS-1 — Estado seleccionado no anunciado a tecnologías de asistencia

La multiselección de la ficha y los chips de filtro comunican el estado activo únicamente mediante color, borde y el icono de check. Los botones nuevos no exponen `aria-pressed` ni una semántica equivalente.

Esto no afecta el funcionamiento visual ni los criterios funcionales, pero un lector de pantalla no recibe de forma explícita qué etiquetas están seleccionadas.

**Sugerencia:** añadir `aria-pressed={activa}` en la multiselección y `aria-pressed={chip === key}` en los filtros; agrupar y etiquetar los conjuntos si se realiza una revisión de accesibilidad más amplia.

### OBS-2 — Driver no reproducible sobre el residuo que deja

El driver se describe como idempotente, pero si ya existe `Consultoría Premium` omite crear `Consultoría` y, acto seguido, sigue exigiendo que `Consultoría` sea visible. El residuo documentado de esta corrida es precisamente `Consultoría Premium`, por lo que una repetición directa no conserva los 16 PASS.

Además, el script y las capturas viven en `tmp/`, directorio ignorado por Git, y por sí solos no constituyen evidencia durable.

**Sugerencia:** usar nombres únicos por corrida o preparar/limpiar fixtures, corregir la aserción del estado ya renombrado y conservar el driver o su reporte en el archivo formal de auditoría o en otro almacenamiento persistente.

### OBS-3 — El driver no vigila errores del navegador

El script no escucha `pageerror`, fallos de red ni mensajes `console.error`. La captura de gestión muestra el indicador rojo de desarrollo **“2 Issues”**. Es razonable inferir que al menos parte del indicador proviene del rechazo esperado por duplicado, porque el `catch` registra ese `ConvexError` con `console.error`; la evidencia guardada no permite demostrarlo.

No se considera bloqueante porque TypeScript, ESLint, build declarado y los flujos funcionales concluyeron correctamente, pero el conteo 16/16 no equivale a una corrida libre de errores de navegador.

**Sugerencia:** hacer fallar el driver ante `pageerror` y errores de consola inesperados, y evitar registrar como error técnico las validaciones de negocio esperadas o incluirlas en una lista explícita de excepciones.

### OBS-4 — Faltan pruebas negativas directas de autorización y aislamiento

La evidencia E2E confirma que Carlos no ve la creación y que `/etiquetas` lo redirige, pero no invoca directamente las mutaciones administrativas con una sesión operativa ni intenta asignar una etiqueta de otro negocio.

La revisión estática confirma que esas defensas sí existen en servidor, por lo que el hueco es de cobertura y no un defecto conocido.

**Sugerencia:** agregar pruebas de servidor para `crear`, `renombrar` y `eliminar` con rol operativo; para identificadores de otro negocio; y para una etiqueta eliminada o inexistente en `cambiarEtiquetas`.

### OBS-5 — Escalabilidad del conteo y de la eliminación

`etiquetas.listar` lee todos los clientes del negocio para calcular conteos, y `etiquetas.eliminar` vuelve a leerlos y puede escribir muchos documentos dentro de una sola mutación.

Es adecuado para el volumen actual del demo, pero puede acercarse a límites de lectura/escritura y aumentar el costo reactivo cuando crezca el número de clientes.

**Sugerencia:** antes de operar con volúmenes altos, evaluar una tabla de asignaciones normalizada con índices por etiqueta y por cliente, o contadores mantenidos transaccionalmente. En esa revisión también conviene decidir si la limpieza automática debe actualizar `clientes.actualizadoEn`, como sí ocurre al modificar etiquetas manualmente.

## Verificación mínima en producción

1. Desplegar primero schema y funciones de Convex.
2. Confirmar que clientes existentes sin etiquetas siguen abriendo y listándose.
3. Como admin, crear dos etiquetas QA y comprobar el rechazo visible de un duplicado con distinta capitalización.
4. Asignar ambas a un cliente QA y verificar chips y conteos.
5. Filtrar por una etiqueta y combinarla con el buscador.
6. Como operativo, asignar o quitar una etiqueta y confirmar que no puede entrar a la gestión ni ejecutar mutaciones administrativas.
7. Renombrar una etiqueta y comprobar que la ficha y el filtro conservan la asignación.
8. Eliminar una etiqueta asignada y confirmar que desaparece del catálogo, del filtro y de la ficha sin dejar referencias visibles.
9. Limpiar los datos QA y confirmar que Convex y Railway corresponden a `8b153b8`.

Si estas comprobaciones resultan correctas, JUA-36 puede marcarse como Done y registrarse el resultado en Linear.

## Constancia de auditoría

Durante esta revisión no se modificó código, no se desplegaron funciones, no se hizo `git push`, no se alteraron datos de desarrollo o producción y no se ejecutaron acciones en Linear. La única escritura realizada fue esta acta de auditoría dentro de `tmp/`.
