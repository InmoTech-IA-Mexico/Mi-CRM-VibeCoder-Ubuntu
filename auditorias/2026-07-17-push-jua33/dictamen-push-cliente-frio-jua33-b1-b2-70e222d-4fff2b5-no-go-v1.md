# Acta de auditoría de avance — Alerta push de cliente frío (JUA-33) · B-1/B-2 · v1

Fecha: 2026-07-17  
Commits auditados: `5826b4b` + `70e222d` + `4fff2b5`  
Base funcional: `b08d399`  
Estado revisado: candidato local; no desplegado por esta auditoría  
Referencia: dictamen Fase C v1 = **NO-GO** por B-1, B-2, B-3 y B-4  
Veredicto: **NO-GO MANTENIDO — B-3 CERRADO; B-1 Y B-2 PARCIALMENTE REMEDIADOS; B-4 SIGUE PENDIENTE**

---

## Resultado

El complemento `5826b4b` cierra la precisión pendiente de B-3: distingue correctamente subscription caducada de entrega efectiva y aporta cobertura dinámica de lease, fallo terminal e idempotencia.

`70e222d` y `4fff2b5` resuelven partes sustanciales de B-1 y B-2: recalculan el recordatorio próximo, permiten redirigir una fila del responsable tras reasignación y agregan preferencias persistentes separadas de las subscriptions.

No obstante, ambos cambios fallan al combinarse durante la reclamación. Una alerta destinada a un administrador con preferencia `negocio` se redirige al responsable actual, y una preferencia cambiada a `ninguna` después del encolado no se respeta. Esas rutas pueden producir alertas duplicadas al responsable, omitir al admin que hizo opt-in o enviar pese a que el usuario se haya excluido. Por ello B-1 y B-2 no pueden declararse cerrados.

## Integridad y comprobaciones locales

- Cadena lineal corroborada: `b08d399` → `5826b4b` → `70e222d` → `4fff2b5`.
- El delta revisado toca esquema, cola, emisor, encolado, preferencias y UI de Perfil.
- `git diff --check b08d399..4fff2b5` no reportó errores.
- `npx tsc --noEmit` y `npx eslint .` finalizaron correctamente. `npm run build` compiló las 25 rutas tras repetirse fuera del sandbox; el primer intento solo fue bloqueado por la descarga de fuentes Google de Next.js.
- No se ejecutaron mutaciones, drivers ni pruebas contra Convex desde esta auditoría.

## B-3 — Estado: CERRADO

`registrarResultado` recibe ahora `enviadas`, `caducadas` y `fallidas`. Marca `suscripcion_caducada` cuando todos los endpoints se invalidaron con 404/410, `sin_dispositivos` cuando no había ninguno y `entregada` solo si al menos un dispositivo recibió el push. La política de reintento de entrega parcial queda documentada: puede duplicar dispositivos ya exitosos y el tag los colapsa.

El reporte dinámico de driver-33 declara siete PASS, incluidos caducada, éxito, sin dispositivos, lease vencido, tercer fallo e idempotencia. La auditoría no lo reejecutó por su carácter mutante.

## B-1/B-2 — Partes correctamente resueltas

- `revalidarDestino` vuelve a calcular los recordatorios próximos del cliente en la misma mutación que reclama. La ruta dinámica de recordatorio tardío queda respaldada por el reporte B-1.
- Una fila del responsable anterior se puede redirigir al responsable actual activo cuando el cliente cambia de cartera.
- `prefClienteFrio` separa la política de alertas del transporte; el admin por defecto queda en `ninguna`, y la mutación restringe las opciones válidas por rol.
- El encolado inicial respeta los defaults y las preferencias `cartera`, `pool` y `negocio`, como muestran las cinco aserciones declaradas por driver-35.

## Bloqueante B-1/B-2 — La reclamación pierde la identidad de la audiencia

Al encolar un cliente asignado, puede haber dos filas distintas:

- una para el responsable, por su preferencia `cartera`; y
- otra para el administrador, por su preferencia `negocio`.

En `revalidarDestino`, toda fila cuyo cliente tenga `responsableId` devuelve ese responsable actual, sin atender el destinatario original ni su rol/preferencia. Como consecuencia, al reclamar ambas filas:

- la fila del admin `negocio` se reasigna al responsable;
- el responsable recibe dos alertas; y
- el admin que eligió “Todo el negocio” deja de recibir la suya.

El mismo helper tampoco revalida la preferencia actual del destinatario. Una fila encolada mientras el responsable tenía `cartera`, o mientras el admin tenía `negocio`/`pool`, puede enviarse después de que ese usuario seleccione `ninguna`.

Esto incumple la revalidación de política vigente exigida por B-1 y el opt-in persistente de B-2.

### Remediación requerida

Materializar la audiencia de cada fila al encolar, por ejemplo `responsable`, `admin_negocio` o `admin_pool`, y revalidarla al reclamar:

- `responsable`: verificar que el dueño actual esté activo y conserve `cartera`; si cambió, redirigir solo a un nuevo responsable activo con esa preferencia, o descartar.
- `admin_negocio`: conservar el admin original únicamente si sigue activo y con `negocio`; nunca redirigirlo al responsable.
- `admin_pool`: conservar el admin original solo mientras el cliente siga sin asignar, el admin esté activo y conserve `pool`; en otro caso descartar.

Una columna opcional puede permitir tratar filas de desarrollo preexistentes mientras el candidato no se ha desplegado.

## Cobertura de evidencia incompleta

El reporte B-1 afirma 4/4 PASS, pero dos de sus cuatro entradas son setups; responsable inactivo y pool hacia destinatario no-admin están expresamente “cubiertos por código”, no ejecutados. El reporte B-2 verifica encolado inicial, no reclamación tras cambio de preferencia ni coexistencia de admin `negocio` con responsable.

El driver de remediación debe añadir, como mínimo:

1. Responsable `cartera` + admin `negocio`: ambas filas reclaman a usuarios distintos.
2. Admin `negocio` cambia a `ninguna` tras encolar: su fila se descarta, no se redirige.
3. Reasignación: fila del responsable anterior se redirige correctamente; fila admin `negocio` permanece admin.
4. Admin `pool` con cliente que recibe responsable, o que cambia a `ninguna`: la fila se descarta.
5. Responsable inactivo y pool sin admin válido, ejecutados dinámicamente.

## Observaciones no bloqueantes

- Los helpers QA destructivos (`qaPurgarNotifs`) están exportados en el bundle de producción y se protegen por variable `QA_HELPERS`. Aunque son internos, antes del despliegue debe verificarse que esa variable no existe en producción y que no hay ruta de aplicación que los invoque.
- El valor efectivo por defecto de un observador en `miPreferenciaFrio` se deriva como `cartera`, aunque el observador no puede guardarlo y no recibe en el encolado. Conviene devolver `ninguna` para coherencia de API.
- B-4 sigue en ejecución; la entrega automática a `/clientes/[id]` no puede usarse como cierre mientras B-1/B-2 puedan alterar a quién se entrega una fila.

## Estado consolidado

| Bloqueante | Estado |
|---|---|
| B-1 — Revalidación de destino | Parcial; recordatorio/reasignación simple resueltos, audiencia/política vigente no |
| B-2 — Preferencias opt-in | Parcial; modelo y encolado resueltos, reclamación no respeta preferencia vigente |
| B-3 — Cola durable | Cerrado |
| B-4 — Entrega automática/deep-link | Pendiente |

## Constancia de auditoría

La revisión fue de solo lectura sobre Git, código y reportes locales. No se modificó código de aplicación, datos de desarrollo o producción, secretos, despliegues, repositorio remoto ni Linear. Esta acta es el único archivo creado por la auditoría.
