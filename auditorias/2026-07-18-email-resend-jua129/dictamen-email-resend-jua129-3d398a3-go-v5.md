# Dictamen de auditoría — Integración de email (Resend, JUA-129) · v5 (GO)

Fecha: 2026-07-18
Rango auditado: `2bb15ab..3d398a3`
Veredicto: **GO CON OBSERVACIONES NO BLOQUEANTES — despliegue inerte controlado autorizado**

(Transcripción del dictamen relatado por el operador; los NO-GO v1–v4 y sus remediaciones constan en las
actas `auditoria-email-resend-jua129-remediacion-v2..v5`.)

## Resultado

Se levanta el NO-GO de JUA-129. `3d398a3` separa correctamente la secuencia monotónica de reclamaciones
(`intentos`) del presupuesto de reintentos transitorios (`fallosTransitorios`). Los bloqueos de
configuración y las recuperaciones de lease ya no agotan los reintentos de 429/5xx/red. La outbox es apta
para desplegarse **sin `RESEND_API_KEY` en producción** (flush inerte; se conserva "copiar enlace").

## Estado de los bloqueantes

- **B-4 (presupuesto contaminado): RESUELTO.** `reclamarLote` solo incrementa `intentos` (guarda de lease);
  `registrarResultado` incrementa `fallosTransitorios` solo en clase `transitorio`; el tope se mide con ese
  campo; `config` (401/403) vuelve a `pendiente` (`bloqueado_config`, 15 min) sin tocar el presupuesto.
  Driver: 3×401 + 503 tras corregir config → pendiente con `fallosTransitorios=1`, no descartado.
- **v1 B-1/B-2/B-3, v2 B-1/B-2, v3 B-3 + OBS-1:** confirmados resueltos.

## Revisión consolidada

Outbox durable (referencias no secretas, lease, recuperación de leases, revalidación previa, backoff,
purga terminal por antigüedad); token/destinatario fuera de la fila y del scheduler (derivados al reclamar);
`Idempotency-Key` estable por evento — entrega al menos una vez con dedup best-effort en la ventana de 24 h;
base URL normalizada a origen HTTPS (salvo localhost dev), enlace escapado en HTML, `EMAIL_FROM` obligatorio;
índice `(estado, creadoEn)` para purga por rango.

## Comprobaciones independientes

`git diff --check` OK · unit plantillas 30 PASS · `tsc` OK · `eslint` OK · `build` OK (25 rutas) · reporte
driver-45 16/16 (incl. B-4). No se repitió el driver (modifica dev).

## Observaciones no bloqueantes

1. **Prueba real de Resend** en dev antes de habilitar credenciales para usuarios reales.
2. **Observabilidad** de `bloqueado_config` (conteo administrativo) — opcional a futuro.
3. **Evidencia** en `tmp/` → copiar sanitizada a `auditorias/2026-07-18-email-resend-jua129/` al cerrar.

## Salvaguardas de despliegue autorizadas

1. `QA_HELPERS` ausente en producción.
2. Desplegar primero Convex (tabla `emailsSalientes`, índices, cron, actions).
3. Verificar el contrato productivo antes del `git push`.
4. Mantener `RESEND_API_KEY` **ausente** en prod (despliegue inerte).
5. Tras la prueba real satisfactoria, cargar solo en Convex `RESEND_API_KEY`/`EMAIL_FROM`/`APP_BASE_URL`
   válidas y verificar con un QA revocable antes de declarar JUA-129 Done.
