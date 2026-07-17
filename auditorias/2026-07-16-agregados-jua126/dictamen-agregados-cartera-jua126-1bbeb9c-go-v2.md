# Acta de auditoría — Visibilidad de agregados por cartera (JUA-126) · v2

Fecha: 2026-07-16  
Commits auditados: `2e92576` + `1bbeb9c`  
Base productiva declarada: `7dfa2aa`  
Estado revisado: candidato local; no desplegado por esta auditoría  
Referencia: dictamen v1 = **NO-GO** por B-1  
Veredicto: **GO CON OBSERVACIONES NO BLOQUEANTES**

---

## Resultado

Se levanta el NO-GO de JUA-126. La política de visibilidad en servidor de `2e92576` se conserva y `1bbeb9c` corrige el único efecto visible bloqueante: un operativo ya no recibe el literal `null` al programar una tarea personal.

No se identificó una regresión de autorización, exposición de agregados ni comportamiento de interfaz que impida desplegar el candidato.

## Integridad y alcance

- `1bbeb9c` tiene como padre directo `400324f`, no `2e92576`.
- El commit intermedio `400324f` añade exclusivamente documentación de auditoría del incidente JUA-38. No altera código de aplicación ni runtime.
- El delta completo `2e92576..1bbeb9c` contiene esa acta documental y los dos ajustes de interfaz declarados.
- `git diff --check 2e92576..1bbeb9c` no reportó errores.
- `npx tsc --noEmit` y `npx eslint .` finalizaron correctamente. `npm run build` compiló las 25 rutas correctamente tras repetirse fuera del sandbox: el primer intento quedó impedido únicamente por la descarga de fuentes Google de Next.js.
- No se ejecutaron drivers ni mutaciones de Convex, no se modificaron datos, no hubo despliegue, `git push` ni acciones en Linear desde esta auditoría.

## Revisión del bloqueo B-1

**Estado: RESUELTO.**

`usuarios.equipo` continúa devolviendo `clientes: null` a operativo y observador, que es la política de minimización acordada. Los dos consumidores que interpolaban ese campo manejan ahora explícitamente el valor ausente:

- `pantalla-programar-seguimiento.tsx`: `subtituloMiembro` devuelve solo el rol si `clientes == null`; para un operativo en una tarea personal se muestra, por ejemplo, `Operativo`.
- `selector-responsable.tsx`: aplica la misma regla. Aunque hoy es una superficie exclusiva de administración, queda consistente y protegida ante reutilización futura.

Cuando el solicitante es administrador, ambos conservan el formato con la cifra numérica de clientes. La corrección no toca el esquema ni cambia las queries, por lo que no reintroduce la carga de otras carteras en respuestas para roles no administrativos.

## Verificación de evidencia

### Interfaz

El driver `tmp/drivers-jua126/driver-28-agregados-ui.js` pasa la comprobación sintáctica y contiene las cinco aserciones declaradas:

- Operativo: selecciona destino Empleado y ve su rol.
- Operativo: no ve texto `null`.
- Admin: abre la selección de empleado y ve una carga numérica.
- Admin: no ve cargas `null`.
- Vigilancia de `pageerror` y `console.error` inesperados.

El reporte preservado declara **5 PASS / 0 FAIL** y las dos capturas son coherentes con el flujo. No se reejecutó porque inicia sesiones y navega contra Convex dev.

### Servidor y limpieza

El driver `tmp/drivers-jua126/driver-27-agregados-servidor.js` pasa sintaxis de Node. La preparación, incluidos los inicios de sesión, está dentro de `try/finally`; el `finally` elimina los clientes, etiqueta y observador QA cuando se hubieran creado y cierra las sesiones disponibles.

El reporte sanitizado declara **5 PASS / 0 FAIL**: carga nula para operativo y observador, carga numérica para admin, y conteo de etiqueta de `1` para la cartera del operativo frente a `2` para el administrador. Esto cubre además las OBS-1 y OBS-2 del dictamen anterior.

## Observaciones no bloqueantes

### OBS-1 — Referencia de base del acta candidata

La frase “`1bbeb9c` sobre `2e92576`” omite el padre documental intermedio `400324f`. Conviene actualizar el acta de entrega o el comentario de cierre para reflejar la cadena real: `2e92576` → `400324f` (documentación) → `1bbeb9c` (remediación UI). No afecta el contenido funcional ni el despliegue.

### OBS-2 — Archivado de evidencia viva

Los reportes y capturas revisados aún están bajo `tmp/`, ignorado por Git. Antes de marcar JUA-126 como Done, debe conservarse la evidencia sanitizada de la verificación productiva en `auditorias/2026-07-16-agregados-jua126/`, según el proceso ya adoptado.

## Condiciones para el despliegue

Se autoriza el plan propuesto:

1. Desplegar las funciones de Convex y corroborar contra producción que la política desplegada está presente antes de liberar el frontend.
2. Desplegar el frontend `1bbeb9c`.
3. En vivo, comprobar una tarea personal de operativo sin `null` y una selección administrativa con cargas numéricas.
4. Archivar reporte y capturas sanitizados antes del cierre en Linear.

## Constancia de auditoría

La revisión fue de solo lectura sobre Git, código, drivers, reportes y capturas. No se modificó código de aplicación, configuración, datos de desarrollo o producción, despliegues, repositorio remoto ni Linear. Esta acta es el único archivo creado por la auditoría.
