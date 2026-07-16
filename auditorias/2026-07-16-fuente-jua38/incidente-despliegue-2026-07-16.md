# Reporte de incidente para auditoría — Despliegue desalineado (JUA-38)

Fecha: 2026-07-16
Severidad: **Media** (funcionalidad nueva rota en prod durante una ventana; sin caída general, sin pérdida de datos)
Estado: **RESUELTO y verificado en vivo**
Componentes: Convex prod `glad-bird-297` · frontend Railway `mi-crm-vibecoder-ubuntu-production`

--------------------------------------------------------------------

## Resumen

Al desplegar JUA-38 (fuente de contacto), el `npx convex deploy` a producción se reportó como
exitoso (**"Deployed Convex functions to https://glad-bird-297.convex.cloud"**) **dos veces sin haber
empujado realmente el código nuevo**. El frontend **sí** se desplegó (Railway, commit `a5b951c`), por
lo que producción quedó **desalineada**: el cliente web nuevo enviaba los args `fuenteTipo`/
`fuenteDetalle` que las funciones viejas de Convex en prod rechazaban.

Se detectó en la **verificación en vivo** (no llegó a usuarios reales conocidos) y se corrigió con un
re-deploy real verificado contra prod.

## Cronología

1. Deploy de Convex reportado OK (1er intento) → se continúa con `git push` → Railway `a5b951c` SUCCESS.
2. **Verificación en vivo (backend `--prod`)** falla en el 1er caso:
   `ArgumentValidationError: Object contains extra field 'fuenteDetalle' that is not in the validator`.
   El validador de `clientes.actualizar` en prod era el **antiguo** (sin campos de fuente).
3. Corroboración: `clientes.detalle --prod` **no** devolvía las claves `fuenteTipo`/`fuenteDetalle`
   → todo JUA-38 ausente en prod.
4. Se confirma que **el origen es correcto**: los archivos en disco tienen los cambios (schema/clientes),
   `git` en `a5b951c` con árbol limpio, y **dev** (merry-squirrel-978) sí los tenía (drivers en verde).
5. 2º deploy reportado OK → prod **sigue** sin los cambios (misma `ArgumentValidationError`).
6. **Corrección:** re-deploy de Convex asignando pseudo-TTY para responder el prompt no interactivo:
   `echo y | script -qec "npx convex deploy" /dev/null`. Esta vez la salida muestra el push completo:
   `Uploading functions… Generating TypeScript bindings… Pushing code… Schema validation complete… Deployed`.
7. **Verificado en vivo tras la corrección:** backend `--prod` 4/4 + UI E2E contra la URL de prod 11/11
   (0 errores), con cliente QA creado y eliminado. Prod sin residuales (equipo y nº de clientes originales).

## Impacto

- **Acotado a la funcionalidad nueva.** Con backend viejo + frontend nuevo:
  - Editar un cliente y **seleccionar una fuente** → el guardado fallaba (ArgumentValidationError,
    mostrado como error genérico de guardado).
  - Editar **sin tocar la fuente** → seguía funcionando (el cliente Convex omite los args `undefined`,
    así que no se enviaba ningún campo extra).
  - Lectura (ficha/lista) → degradación limpia: sin fuente visible, "Sin definir", sin chips de fuente.
- Sin caída general, sin pérdida ni corrupción de datos. Ventana: desde el push de Railway `a5b951c`
  hasta el deploy correctivo de Convex (dentro de esta misma sesión de trabajo).

## Causa raíz

No determinada con certeza. Los dos primeros `convex deploy` reportaron éxito pero **no** empujaron el
código (el push real —bundling/upload/schema-validation— solo apareció en el 3er intento). El origen en
disco y en git estaba correcto en todo momento. Hipótesis: los primeros deploy se corrieron desde un
contexto que no reflejaba los cambios en disco, o el prompt interactivo abortó el push mientras se
observaba un mensaje de éxito previo. **El hecho verificable es que prod no tenía el código pese al
mensaje "Deployed".**

## Acción correctiva y de transparencia

- **Deploy correctivo ejecutado por el asistente (Claude)** con el método de pseudo-TTY, bajo el GO
  explícito del usuario para desplegar JUA-38. Se señala para conocimiento de auditoría: fue una
  escritura en producción realizada directamente, verificada de inmediato contra prod.
- QA de la verificación: creado y **eliminado**; sin datos QA residuales en prod.

## Lecciones / cambios de proceso (registrados en memoria)

1. **Verificar SIEMPRE contra prod tras `convex deploy`** que el cambio existe —
   `mcp__convex__functionSpec` (prod readOnly lo admite) o una llamada real `npx convex run --prod <fn>`
   que ejercite el arg nuevo. El mensaje "Deployed" **no** es prueba suficiente.
2. El orden Convex→frontend solo protege si el push de Convex **realmente** ocurrió; la verificación es
   parte inseparable del paso.
3. Método fiable de deploy no interactivo documentado para futuros despliegues (con GO explícito).

--------------------------------------------------------------------

Evidencia relacionada: `auditorias/2026-07-16-fuente-jua38/` (incluye esta lección en su README) y los
reportes `reporte-fuente-servidor-prod.txt` / `reporte-fuente-ui-prod.txt`.
