// Verificación de Cloudflare Turnstile para el registro público (JUA-39, cierre de B-2).
// La usa el Route Handler `/api/registro` (servidor). Contrato completo de Siteverify:
// server-side por token, valida `success` + `hostname` + `action`, cota el token, timeout,
// idempotency_key, y FALLA CERRADO ante cualquier error (red, JSON, expiración/replay).
// `remoteip` lo pasa el Route Handler desde la frontera Cloudflare (CF-Connecting-IP), nunca
// desde el payload del navegador.

export const TURNSTILE_ACTION = "registro_negocio"; // action fijo configurado en el widget
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TOKEN_MAX = 2048; // Cloudflare: los tokens no superan ~2048 chars
const TIMEOUT_MS = 5000;

export type TurnstileOutcome = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export type TurnstileResultado = { ok: boolean; razon?: string };

/**
 * Clasifica la respuesta de Siteverify (PURA, testeable). Fail-closed: solo `ok` si
 * `success === true` ∧ hostname esperado ∧ action esperada. Surface del `error-codes`
 * (p. ej. `timeout-or-duplicate` = token expirado/reusado) como razón para telemetría.
 */
export function evaluarTurnstile(
  o: TurnstileOutcome | null | undefined,
  opts: { hostEsperado: string; actionEsperada: string },
): TurnstileResultado {
  if (!o || o.success !== true) return { ok: false, razon: o?.["error-codes"]?.[0] ?? "no_success" };
  if (o.hostname !== opts.hostEsperado) return { ok: false, razon: "hostname" };
  if (o.action !== opts.actionEsperada) return { ok: false, razon: "action" };
  return { ok: true };
}

/**
 * Verifica un token de Turnstile contra Cloudflare. Fail-closed ante secreto ausente, token
 * vacío/sobredimensionado, timeout, respuesta no-2xx, JSON inválido o clasificación negativa.
 */
export async function verificarTurnstile(params: {
  token: string;
  secret: string | undefined;
  remoteip?: string;
  hostEsperado: string;
  idempotencyKey: string;
}): Promise<TurnstileResultado> {
  const { token, secret, remoteip, hostEsperado, idempotencyKey } = params;
  if (!secret) return { ok: false, razon: "sin_secreto" }; // inerte sin config
  if (!token || token.length > TOKEN_MAX) return { ok: false, razon: "token_invalido" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (remoteip) form.set("remoteip", remoteip); // solo de la frontera Cloudflare de confianza
    form.set("idempotency_key", idempotencyKey);
    const res = await fetch(SITEVERIFY, { method: "POST", body: form, signal: controller.signal });
    if (!res.ok) return { ok: false, razon: `http_${res.status}` };
    let o: TurnstileOutcome;
    try {
      o = (await res.json()) as TurnstileOutcome;
    } catch {
      return { ok: false, razon: "json" };
    }
    return evaluarTurnstile(o, { hostEsperado, actionEsperada: TURNSTILE_ACTION });
  } catch {
    return { ok: false, razon: "red_o_timeout" };
  } finally {
    clearTimeout(timer);
  }
}
