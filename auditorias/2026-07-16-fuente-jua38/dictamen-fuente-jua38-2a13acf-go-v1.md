# Acta de auditoría — Fuente de contacto (JUA-38) · v1

Fecha: 2026-07-16
Commit auditado: `2a13acf`
Base anterior: `5a95052`
Estado revisado: candidato local; no desplegado por esta auditoría
Veredicto: **GO CON OBSERVACIONES NO BLOQUEANTES**

---

## Resultado

Se autoriza el paso a despliegue y verificación en vivo de JUA-38.

La implementación añade una fuente de contacto opcional, con categoría acotada y detalle libre breve, sin introducir una nueva superficie pública ni debilitar las restricciones de cartera y solo lectura ya vigentes. Los datos existentes siguen siendo válidos porque los dos campos del esquema son opcionales.

## Integridad y comprobaciones locales

- `2a13acf` es hijo directo de `5a95052`; este último era `origin/main` durante la auditoría.
- Delta: 6 archivos, `+174 −17`: esquema, `clientes.ts`, catálogos y tres componentes de cliente. No modifica autenticación, roles, rutas, crons ni el formulario de alta rápida.
- `git diff --check 5a95052..2a13acf` no reportó errores. El árbol estaba limpio antes de crear esta acta.
- `npx tsc --noEmit`, `npx eslint .` y `npm run build` finalizaron correctamente. El primer build local no pudo descargar fuentes de Google por la restricción de red; el reintento autorizado compiló las 25 rutas sin errores.
- No se ejecutaron drivers, mutaciones de Convex, despliegues, publicaciones ni acciones en Linear desde esta auditoría.

## Revisión funcional y de seguridad

### Esquema y compatibilidad
**Correcto.** `clientes.fuenteTipo` y `clientes.fuenteDetalle` son opcionales. El catálogo del esquema y `FUENTES_CONTACTO` contienen el mismo conjunto de cinco valores: `referido`, `campana`, `evento`, `visita` y `otro`. No se requiere migración para clientes existentes.

### Validación en servidor
**Correcta.** `clientes.actualizar` valida el tipo con el validador Convex de unión. Solo persiste `fuenteDetalle` si recibe un tipo; aplica `trim()` y limita el valor a 120 caracteres. Por tanto, una llamada directa sin categoría no deja detalle huérfano y una UI no es la única defensa.

### Autorización y cartera
**Correcta.** La fuente usa la mutación preexistente `clientes.actualizar`, que exige sesión de escritura y ejecuta `verificarCartera` después de comprobar negocio y papelera. El observador queda rechazado por `resolverSesionEscritura`; el operativo solo puede editar un cliente de su cartera. `detalle` y `listar` ya aplican el mismo ámbito de cartera. La exposición adicional de `fuenteTipo` en ambas respuestas no amplía quién puede leer un cliente.

### Filtro de lista y alta rápida
**Correcto.** Los chips dinámicos se construyen a partir de la respuesta ya autorizada de `clientes.listar`; el filtro se aplica en memoria sobre ese mismo conjunto. No hay consulta, identificador o conteo de una cartera ajena. El alta rápida no referencia `fuenteTipo` ni `fuenteDetalle`, conforme al criterio de flujo mínimo.

### Presentación en ficha
**Correcta.** La ficha diferencia tipo y detalle, y muestra "Sin definir" cuando no existe categoría. Si por un dato legado hubiera detalle sin tipo, no se expone como fuente definida; la siguiente edición lo sanea al eliminarlo.

## Evidencia revisada

- `tmp/drivers-jua38/driver-25-fuente.js` pasa comprobación sintáctica de Node y usa credenciales por variables de entorno.
- El reporte preservado declara 11 PASS / 0 FAIL, incluida vigilancia de `pageerror` y `console.error`.
- El escenario cubre seleccionar Campaña, guardar detalle, visualizar ambos valores en ficha, filtrar la lista, comprobar ausencia en alta rápida y limpiar la fuente.
- Las tres capturas `d25-*` son consistentes con las comprobaciones declaradas.

## Observaciones no bloqueantes

### OBS-1 — Estado seleccionado no expuesto a tecnología asistiva
Los cinco botones de categoría actúan como toggle de selección única, pero no declaran `aria-pressed`. Sugerencia: añadir `aria-pressed={activo}`, consistente con los chips y selectores ya auditados, o `role="radiogroup"`.

### OBS-2 — Negativas de servidor no ejercitadas dinámicamente
El driver es UI y no verifica por invocación directa: detalle sin tipo, recorte de 120, tipo inválido, observador rechazado ni operativo sobre cliente ajeno. Conviene añadir un driver de servidor breve.

### OBS-3 — Limpieza del driver ante fallos
La limpieza ocurre al final del flujo feliz dentro de `try`; el `finally` solo cierra navegador. Sugerencia: guardar/restaurar el valor previo dentro de `finally` y sustituir pausas fijas por esperas observables.

### OBS-4 — Evidencia aún temporal
Driver, reporte y capturas permanecen en `tmp/`. Antes del cierre deben copiarse a `auditorias/2026-07-16-fuente-jua38/`.

## Condiciones para el despliegue

1. Desplegar primero Convex, pues el esquema añade dos campos opcionales y la UI ya los consulta.
2. Verificar en producción con un cliente QA: edición, ficha, chip de filtro y ausencia en alta rápida.
3. Restaurar o eliminar el dato QA y archivar reporte y capturas sanitizados antes de marcar JUA-38 como Done.

## Constancia de auditoría

Revisión de solo lectura sobre Git, código, driver, reporte, capturas y comprobaciones locales. No se modificó código, configuración, datos, despliegues, repositorio remoto ni Linear.
