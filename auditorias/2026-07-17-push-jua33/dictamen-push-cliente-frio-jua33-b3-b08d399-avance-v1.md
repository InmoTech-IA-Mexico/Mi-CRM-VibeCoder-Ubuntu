# Acta de auditoría de avance — Alerta push de cliente frío (JUA-33) · B-3 · v1

Fecha: 2026-07-17  
Commit auditado: `b08d399`  
Base funcional: `337cc05`  
Estado revisado: candidato local; no desplegado por esta auditoría  
Referencia: dictamen Fase C v1 = **NO-GO** por B-1, B-2, B-3 y B-4  
Veredicto: **AVANCE ACEPTADO CON PRECISIÓN PENDIENTE — EL NO-GO GLOBAL CONTINÚA**

---

## Resultado

La remediación convierte correctamente la cola de B-3 en un flujo durable de reclamación → envío → resultado: incorpora `enviando`, lease, contador, backoff, lote limitado e idempotencia por número de intento. El defecto central —marcar como enviada una falla transitoria— queda remediado en la ruta ejercida.

No se levanta el NO-GO de Fase C: B-1, B-2 y B-4 permanecen fuera de este commit. Además, B-3 requiere una corrección menor de clasificación y cobertura dinámica adicional antes de declararse completamente cerrado.

## Integridad y comprobaciones locales

- `b08d399` es hijo directo de `337cc05`.
- Delta limitado a `clientes.ts`, `notificaciones.ts`, `pushEnvio.ts` y `schema.ts`.
- `git diff --check 337cc05..b08d399` no reportó errores.
- `npx tsc --noEmit` y `npx eslint .` finalizaron correctamente. `npm run build` compiló las 25 rutas después de repetirse fuera del sandbox; el primer intento solo fue impedido por la descarga de fuentes Google de Next.js.
- No se ejecutaron flujos Convex desde esta auditoría.

## B-3 revisado

### Reclamación y recuperación

`reclamarLote` recupera filas `enviando` cuyo lease venció, selecciona hasta 50 pendientes elegibles, conserva las nocturnas pendientes, descarta clientes obsoletos y reclama los demás incrementando `intentos` y fijando una lease de cinco minutos. Esto resuelve la ausencia previa de ownership durable entre acción y cola.

### Resultado real y reintento

La acción pasa `total` y `fallidas` de `enviarAUsuario` a `registrarResultado`. Una falla transitoria devuelve la fila a `pendiente`, limpia el lease y programa un backoff proporcional al intento; el tercer fallo pasa a `descartada`. La mutación ignora resultados de intentos antiguos cuando el lease se perdió y otro intento ya reclamó la fila.

El reporte preservado respalda la ruta central: con una subscription fake el resultado fue `reclamadas: 1`, `enviadas: 0`, `conFallo: 1`, y la fila quedó pendiente con `intentos: 1`, lease limpio y `proximoIntento` futuro. No se reejecutó por la auditoría porque el escenario crea y modifica datos en Convex dev.

## Precisión pendiente de B-3

### P-1 — 404/410 se registra como “entregada” aunque no hubo entrega

`enviarAUsuario` cuenta respuestas 404/410 en `caducadas`, borra condicionalmente la subscription y deja `fallidas = 0`. `registrarResultado` solo recibe `total` y `fallidas`; por ello marca `resultado: "entregada"` cuando `total > 0`, incluso si todos los endpoints devolvieron 404/410 y ningún dispositivo recibió el push.

El estado terminal puede ser válido —no se debe reintentar un endpoint caducado—, pero el resultado debe reflejarlo como, por ejemplo, `sin_dispositivos` o `suscripcion_caducada`, no como entrega efectiva. Debe pasarse `caducadas` (y, si corresponde, `enviadas`) a la mutación de resultado.

## Observaciones no bloqueantes

- En una entrega parcial, se reintenta el conjunto completo de subscriptions del usuario; los dispositivos que ya recibieron el push pueden volver a verlo. La semántica actual solo documenta duplicados tras recuperación de lease, no tras fallo parcial. Conviene declararlo y probarlo, o modelar entregas por dispositivo si se requiere reducir duplicados.
- Recuperación de lease vencido, agotamiento de tres intentos, idempotencia de resultado y descarte obsoleto aparecen solo como cobertura por código. Deben entrar en un driver con control de tiempo o helpers internos de prueba antes del cierre.
- El reporte declara residuos dev: una fila enviada, una pendiente en backoff y un cliente demo Inactivo. Deben limpiarse o aislarse antes de archivar evidencia.

## Estado de bloqueantes de Fase C

| Bloqueante | Estado |
|---|---|
| B-1 — Recordatorio/destinatario vigentes | Abierto |
| B-2 — Preferencias de Marta/negocio | Abierto |
| B-3 — Cola durable | Avance aceptado; P-1 pendiente |
| B-4 — Entrega automática y deep-link a ficha | Abierto |

## Condición para declarar B-3 cerrado

1. Corregir P-1 y validar 404/410 sin marcar falsamente `entregada`.
2. Ejecutar dinámicamente recuperación de lease, tercer fallo terminal, idempotencia del intento y resultado de caducada.
3. Registrar la política de entrega parcial y limpiar los residuos QA.

## Constancia de auditoría

La revisión fue de solo lectura sobre Git, código y reportes locales. No se modificó código de aplicación, datos de desarrollo o producción, secretos, despliegues, repositorio remoto ni Linear. Esta acta es el único archivo creado por la auditoría.
