"use node";

import { action } from "./_generated/server";
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
type Suscripcion = { endpoint: string; p256dh: string; auth: string };

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
      enviadas++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await ctx.runMutation(internal.push.borrarPorEndpoint, { endpoint: s.endpoint });
        caducadas++;
      } else {
        fallidas++;
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
