import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Frontera de servidor del registro público (JUA-39, diseño v3). Esta httpAction es el ÚNICO
// punto por el que se crea un registro pendiente. La llama SOLO el Route Handler de Next
// (tras verificar Turnstile + origen Cloudflare) presentando `REGISTRO_SERVER_SECRET` en el
// header — credencial SOLO de servidor: el navegador no puede crear pendientes (cierre B-1).
// La creación real es una internalMutation (`registro.crearPendiente`), no una función pública.

const http = httpRouter();

const MAX_CAMPO = 512; // cota defensiva de tamaño antes de pasar a la mutación (la mutación revalida)

/** Comparación en tiempo (casi) constante del secreto (obs. control 1). */
function igualConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
}

http.route({
  path: "/registro/crear",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.REGISTRO_SERVER_SECRET;
    if (!secret) return json({ ok: false, error: "registro deshabilitado" }, 503); // inerte sin secreto
    const auth = request.headers.get("Authorization") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!igualConstante(provided, secret)) return json({ ok: false, error: "no autorizado" }, 401);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "payload inválido" }, 400);
    }
    const b = (body ?? {}) as Record<string, unknown>;
    const str = (x: unknown) => (typeof x === "string" ? x : "");
    for (const k of ["nombreNegocio", "nombreAdmin", "email", "password", "zonaHoraria"]) {
      if (str(b[k]).length > MAX_CAMPO) return json({ ok: false, error: "payload inválido" }, 400);
    }

    try {
      const res = await ctx.runMutation(internal.registro.crearPendiente, {
        nombreNegocio: str(b.nombreNegocio),
        nombreAdmin: str(b.nombreAdmin),
        email: str(b.email),
        password: str(b.password),
        zonaHoraria: str(b.zonaHoraria),
      });
      if (!res.ok && res.motivo === "rate_limited") return json({ ok: false, motivo: "rate_limited" }, 429);
      return json({ ok: true }, 200); // genérico: no revela nada del email (anti-enumeración)
    } catch (e) {
      // ConvexError de validación → 400 con el mensaje; cualquier otro → 500 genérico (sin fuga).
      const data = (e as { data?: unknown }).data;
      if (typeof data === "string") return json({ ok: false, error: data }, 400);
      return json({ ok: false, error: "error" }, 500);
    }
  }),
});

export default http;
