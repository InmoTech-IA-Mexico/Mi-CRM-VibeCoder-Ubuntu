import type { NextRequest } from "next/server";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { verificarTurnstile } from "@/lib/turnstile";
import { leerCuerpoAcotado } from "@/lib/http-body";

const MAX_BODY = 8 * 1024; // 8 KiB: holgado para todos los campos máximos + token de Turnstile

// Frontera pública de escritura del registro (JUA-39, cierre de B-1). Único punto por el que
// el navegador inicia el alta; debe llegar a través de Cloudflare (Rate Limiting + Transform
// Rule que inyecta `X-Edge-Auth`). Orden (control 1): valida el origen-edge en tiempo constante
// ANTES de leer `CF-Connecting-IP` o verificar Turnstile; luego verifica Turnstile (contrato
// completo, IP de la frontera) y solo entonces llama a la httpAction de Convex con el secreto
// de servidor. Inerte (503) sin configuración completa — despliegue seguro.

export const runtime = "nodejs"; // node:crypto (timingSafeEqual) + fetch de servidor

function respuesta(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}

/** Comparación en tiempo constante (control 1). Longitudes distintas → false sin timing útil. */
function secretosIguales(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

const str = (x: unknown) => (typeof x === "string" ? x : "");

export async function POST(request: NextRequest) {
  const edgeSecret = process.env.EDGE_SECRET;
  const serverSecret = process.env.REGISTRO_SERVER_SECRET;
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  // Fallo cerrado: sin configuración completa, el registro está deshabilitado.
  if (!edgeSecret || !serverSecret || !turnstileSecret || !convexUrl) {
    return respuesta({ ok: false, error: "registro deshabilitado" }, 503);
  }

  // 1) Origen Cloudflare: rechaza ANTES de leer IP/Turnstile o el cuerpo.
  const edge = request.headers.get("x-edge-auth") ?? "";
  if (!secretosIguales(edge, edgeSecret)) return respuesta({ ok: false, error: "no autorizado" }, 401);

  // 2) Cuerpo ACOTADO por bytes ANTES de Turnstile/Convex (remediación B-1): un JSON enorme se
  //    rechaza (413) sin materializarlo entero ni llamar a Siteverify. Orden: borde → JSON
  //    acotado → Turnstile → Convex.
  const crudo = await leerCuerpoAcotado(request.body, MAX_BODY, request.headers.get("content-length"));
  if (crudo === null) return respuesta({ ok: false, error: "payload demasiado grande" }, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(crudo) as Record<string, unknown>;
  } catch {
    return respuesta({ ok: false, error: "payload inválido" }, 400);
  }

  // 3) Turnstile con la IP de la frontera Cloudflare (nunca del payload).
  const remoteip = request.headers.get("cf-connecting-ip") ?? undefined;
  const veredicto = await verificarTurnstile({
    token: str(body.turnstileToken),
    secret: turnstileSecret,
    remoteip,
    hostEsperado: process.env.TURNSTILE_HOSTNAME ?? "",
    idempotencyKey: randomUUID(),
  });
  if (!veredicto.ok) return respuesta({ ok: false, error: "verificación fallida" }, 403);

  // 4) Alta en Convex vía la httpAction guardada por el secreto de servidor (credencial no
  //    disponible en el navegador). El token de Turnstile NO se reenvía a Convex.
  const siteUrl = convexUrl.replace(".convex.cloud", ".convex.site");
  let r: Response;
  try {
    r = await fetch(`${siteUrl}/registro/crear`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serverSecret}` },
      body: JSON.stringify({
        nombreNegocio: str(body.nombreNegocio),
        nombreAdmin: str(body.nombreAdmin),
        email: str(body.email),
        password: str(body.password),
        zonaHoraria: str(body.zonaHoraria),
      }),
    });
  } catch {
    return respuesta({ ok: false, error: "error" }, 502);
  }
  const data = await r.json().catch(() => ({ ok: false, error: "error" }));
  return respuesta(data, r.status);
}
