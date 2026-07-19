"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { plantillaInvitacion, plantillaRecuperacion, normalizarBaseUrl } from "./emailPlantillas";
import type { Correo } from "./emailPlantillas";
import type { EmailReclamo } from "./emailCola";

// Transporte de correo transaccional (JUA-129). Runtime Node (por `fetch` a la API REST
// de Resend). Reclama un lote de la cola durable (`emailCola`), compone cada correo,
// lo envía con `Idempotency-Key` (sin duplicados, obs. B-3) y registra el resultado.
// INERTE sin `RESEND_API_KEY`: no reclama nada (no quema intentos) y la cola espera.
// Sin claves ni tokens en logs (obs. B-2): solo tipo + status.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM_DEFECTO = "InmoTech IA <onboarding@resend.dev>"; // dev: envía a tu propio correo sin dominio
const MAX_FETCH = 3;

// Tipos de retorno EXPLÍCITOS: rompen la inferencia circular entre la action y la API
// generada (si se omiten, el codegen degrada `internal` a `any`).
type EnvioResultado = { ok: boolean; retriable: boolean; status?: number };
type FlushResultado = { reclamados: number; enviados: number; fallidos: number };

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Base para componer los enlaces en el servidor (la action no tiene `window`). Validada y
 * normalizada (HTTPS salvo localhost; solo el origen) — obs. B-2 del dictamen v2. `null`
 * si falta o es inválida → `flush` inerte, sin reclamar.
 */
function baseUrl(): string | null {
  return normalizarBaseUrl(process.env.APP_BASE_URL);
}

/** Compone el correo de un reclamo (o null si falta la base). El token va solo aquí, en memoria. */
function componer(r: EmailReclamo, base: string): Correo {
  if (r.tipo === "invitacion") {
    const enlace = `${base}/activar?token=${r.token}`;
    return plantillaInvitacion({ nombre: r.nombre, negocioNombre: r.negocioNombre, rol: r.rol ?? "operativo", enlace });
  }
  const enlace = `${base}/nueva-password?token=${r.token}`;
  return plantillaRecuperacion({ enlace, esReactivacion: r.tipo === "reactivacion" });
}

/**
 * Envía un correo por Resend con reintentos acotados. La MISMA `Idempotency-Key` en todos
 * los intentos (y entre flushes) → un reintento tras un envío ya aceptado NO se duplica
 * dentro de la ventana de deduplicación de Resend (24 h). Semántica: entrega **al menos
 * una vez**, dedup *best-effort* en esa ventana (un lease recuperado > 24 h después podría,
 * en el extremo, reenviar). 4xx (salvo 429) = terminal no reintentable; red/429/5xx =
 * transitorio (la cola reintenta con backoff).
 */
async function enviarResend(para: string, correo: Correo, idempotencyKey: string): Promise<EnvioResultado> {
  const key = process.env.RESEND_API_KEY as string;
  const from = process.env.EMAIL_FROM?.trim() || FROM_DEFECTO;
  const cuerpo = JSON.stringify({ from, to: [para], subject: correo.asunto, html: correo.html, text: correo.texto });
  let ultimoStatus: number | undefined;
  for (let intento = 1; intento <= MAX_FETCH; intento++) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: cuerpo,
      });
      ultimoStatus = res.status;
      if (res.ok) return { ok: true, retriable: false, status: res.status };
      if (res.status < 500 && res.status !== 429) {
        console.log(`[email] rechazado status=${res.status} (no se reintenta)`);
        return { ok: false, retriable: false, status: res.status };
      }
      console.log(`[email] transitorio status=${res.status} intento=${intento}`);
    } catch {
      console.log(`[email] fallo de red intento=${intento}`);
    }
    if (intento < MAX_FETCH) await dormir(intento * 400);
  }
  return { ok: false, retriable: true, status: ultimoStatus };
}

/**
 * Vacía la cola de correo (JUA-129). Lo dispara el `runAfter(0)` de `encolar` (latencia
 * baja) y el cron horario (durabilidad). Reclama un lote, envía cada correo con su clave
 * idempotente y registra el resultado real. Inerte sin key o sin base URL: no reclama.
 */
export const flush = internalAction({
  args: {},
  handler: async (ctx): Promise<FlushResultado> => {
    // Inerte si no está configurado el envío: NO se reclama (no se queman intentos); la
    // cola espera a que existan la key y la base. Validación al iniciar (no por correo).
    const base = baseUrl();
    if (!process.env.RESEND_API_KEY || !base) {
      console.log("[email] deshabilitado (falta RESEND_API_KEY, o APP_BASE_URL ausente/inválida); no se reclama la cola");
      return { reclamados: 0, enviados: 0, fallidos: 0 };
    }

    const reclamos: EmailReclamo[] = await ctx.runMutation(internal.emailCola.reclamarLote, {});
    let enviados = 0;
    let fallidos = 0;
    for (const r of reclamos) {
      const correo = componer(r, base);
      const res = await enviarResend(r.para, correo, r.idempotencyKey);
      await ctx.runMutation(internal.emailCola.registrarResultado, {
        id: r.id,
        intentos: r.intentos,
        ok: res.ok,
        retriable: res.retriable,
        status: res.status,
      });
      if (res.ok) enviados++;
      else fallidos++;
      console.log(`[email] ${r.tipo} resultado=${res.ok ? "enviado" : res.retriable ? "reintento" : "descartado"}`);
    }
    return { reclamados: reclamos.length, enviados, fallidos };
  },
});
