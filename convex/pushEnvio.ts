"use node";

import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import webpush from "web-push";

// Emisor Web Push (JUA-33 Fase B). Corre en runtime Node (por `web-push`). Firma
// con VAPID (claves en el entorno de Convex) y envía a cada suscripción del
// usuario; las caducadas (404/410) se borran. El disparo automático (Fase C)
// reutilizará `enviarAUsuario`.

type Payload = { titulo: string; cuerpo: string; url: string; tag?: string };
// Tipos de retorno EXPLÍCITOS: rompen la inferencia circular entre la action y la
// API generada (si se omiten, el codegen degrada `api`/`internal` a `any`).
type Resultado = { total: number; enviadas: number; caducadas: number; fallidas: number };
type Suscripcion = { id: Id<"pushSubscriptions">; endpoint: string; p256dh: string; auth: string; fallosRed: number };

function configurarVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) throw new Error("Faltan las claves VAPID en el entorno de Convex");
  webpush.setVapidDetails(subj, pub, priv);
}

async function enviarAUsuario(ctx: ActionCtx, usuarioId: Id<"usuarios">, payload: Payload): Promise<Resultado> {
  configurarVapid();
  const subs: Suscripcion[] = await ctx.runQuery(internal.push.subsDeUsuario, { usuarioId });
  const cuerpo = JSON.stringify(payload);
  let enviadas = 0;
  let caducadas = 0;
  let fallidas = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo);
      // Éxito: reinicia el contador de fallos de red si venía acumulando (JUA-127).
      if (s.fallosRed > 0) await ctx.runMutation(internal.push.resetFalloRed, { id: s.id, usuarioId, p256dh: s.p256dh });
      enviadas++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await ctx.runMutation(internal.push.borrarSubCaducada, { id: s.id, usuarioId, p256dh: s.p256dh });
        caducadas++;
      } else {
        // Fallo de red sin código HTTP: cuenta consecutivos y poda la sub muerta tras N
        // (JUA-127). Podada → cuenta como caducada (no provoca un reintento inútil); si
        // aún no se poda, es transitorio → `fallidas` (reintento con backoff).
        const r: { podada: boolean } = await ctx.runMutation(internal.push.contarFalloRed, {
          id: s.id,
          usuarioId,
          p256dh: s.p256dh,
        });
        if (r.podada) caducadas++;
        else fallidas++;
      }
    }
  }
  return { total: subs.length, enviadas, caducadas, fallidas };
}

/**
 * Envía una notificación de prueba a los dispositivos del usuario de la sesión.
 * Sirve para validar la entrega real de extremo a extremo antes de automatizar
 * el disparo (Fase C). No revela nada de otros usuarios.
 */
export const enviarPrueba = action({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<Resultado> => {
    const sesion: { usuarioId: Id<"usuarios">; negocioId: Id<"negocios"> } | null =
      await ctx.runQuery(internal.push.usuarioDeSesion, { token });
    if (!sesion) throw new Error("No autorizado");
    return await enviarAUsuario(ctx, sesion.usuarioId, {
      titulo: "🔔 Notificación de prueba",
      cuerpo: "Las alertas de cliente frío están activas en este dispositivo.",
      url: "/inicio",
      tag: "prueba-jua33",
    });
  },
});

/**
 * Vacía la cola de alertas de cliente frío (JUA-33 Fase C). Lo dispara el cron
 * horario: toma las pendientes cuya hora local del negocio es diurna, envía la
 * notificación al destinatario y las marca; descarta las obsoletas. Interno.
 */
export const flushNotificaciones = internalAction({
  args: {},
  handler: async (ctx): Promise<{ reclamadas: number; enviadas: number; conFallo: number }> => {
    const reclamos = await ctx.runMutation(internal.notificaciones.reclamarLote, {});
    let enviadas = 0;
    let conFallo = 0;
    for (const r of reclamos) {
      const res = await enviarAUsuario(ctx, r.usuarioId, {
        titulo: "⚠️ Cliente frío",
        cuerpo: `${r.nombre} lleva 15 días sin contacto`,
        url: `/clientes/${r.clienteId}`,
        tag: `frio-${r.clienteId}`,
      });
      // El resultado REAL decide el estado (éxito/sin dispositivos → enviada;
      // fallo transitorio → reintento con backoff o descarte tras MAX_INTENTOS).
      await ctx.runMutation(internal.notificaciones.registrarResultado, {
        id: r.id,
        intentos: r.intentos,
        enviadas: res.enviadas,
        caducadas: res.caducadas,
        fallidas: res.fallidas,
      });
      if (res.fallidas === 0) enviadas++;
      else conFallo++;
    }
    return { reclamadas: reclamos.length, enviadas, conFallo };
  },
});
