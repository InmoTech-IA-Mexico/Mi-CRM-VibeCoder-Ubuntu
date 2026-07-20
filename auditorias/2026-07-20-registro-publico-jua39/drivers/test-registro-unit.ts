// Unit test (JUA-39): verificador de Turnstile (clasificación pura) + plantilla de verificación.
//   node --experimental-strip-types tmp/drivers-jua39/test-registro-unit.ts
import { evaluarTurnstile, TURNSTILE_ACTION } from "../../src/lib/turnstile.ts";
import { leerCuerpoAcotado } from "../../src/lib/http-body.ts";
import { plantillaVerificacionRegistro } from "../../convex/emailPlantillas.ts";

let fallos = 0;
let total = 0;
function ok(cond: boolean, msg: string) {
  total++;
  console.log((cond ? "PASS" : "FAIL") + " — " + msg);
  if (!cond) fallos++;
}

async function okAsync(p: Promise<boolean>, msg: string) {
  ok(await p, msg);
}

// Construye un ReadableStream que emite `bytes` en trozos de `trozo` (para ejercer el conteo).
function streamDe(bytes: Uint8Array, trozo = 8): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (i >= bytes.length) return c.close();
      c.enqueue(bytes.slice(i, i + trozo));
      i += trozo;
    },
  });
}
const enc = (s: string) => new TextEncoder().encode(s);

// leerCuerpoAcotado (remediación B-1): rechazo temprano por Content-Length, conteo por bytes, ok.
await okAsync(leerCuerpoAcotado(null, 100, "999999").then((r) => r === null), "cuerpo: Content-Length > max → null (rechazo temprano)");
await okAsync(leerCuerpoAcotado(streamDe(enc("x".repeat(500))), 100, null).then((r) => r === null), "cuerpo: stream que supera max (sin Content-Length) → null");
await okAsync(leerCuerpoAcotado(streamDe(enc("x".repeat(500))), 100, "10").then((r) => r === null), "cuerpo: Content-Length mentiroso (pequeño) pero stream grande → null");
await okAsync(leerCuerpoAcotado(streamDe(enc('{"a":1}')), 8192, "7").then((r) => r === '{"a":1}'), "cuerpo: pequeño y válido → devuelve el texto");
await okAsync(leerCuerpoAcotado(streamDe(enc("x".repeat(100))), 100, null).then((r) => r === "x".repeat(100)), "cuerpo: exactamente max → devuelve");
await okAsync(leerCuerpoAcotado(null, 100, null).then((r) => r === ""), "cuerpo: sin body → cadena vacía");

const OPTS = { hostEsperado: "app.inmotechia.mx", actionEsperada: TURNSTILE_ACTION };
const base = { success: true, hostname: "app.inmotechia.mx", action: TURNSTILE_ACTION };

// evaluarTurnstile: fail-closed en cada caso del dictamen.
ok(evaluarTurnstile(base, OPTS).ok === true, "evaluar: success + host + action correctos → ok");
ok(evaluarTurnstile(null, OPTS).ok === false, "evaluar: respuesta nula → rechaza");
ok(evaluarTurnstile({ success: false, "error-codes": ["timeout-or-duplicate"] }, OPTS).ok === false, "evaluar: success:false (timeout-or-duplicate) → rechaza");
ok(evaluarTurnstile({ ...base, hostname: "otro.com" }, OPTS).ok === false, "evaluar: hostname distinto → rechaza");
ok(evaluarTurnstile({ ...base, action: "otra" }, OPTS).ok === false, "evaluar: action distinta → rechaza");
ok(evaluarTurnstile({ success: true, hostname: "app.inmotechia.mx" }, OPTS).ok === false, "evaluar: sin action → rechaza");
ok(evaluarTurnstile({ success: false }, OPTS).razon === "no_success", "evaluar: success:false sin error-codes → razon no_success");
ok(evaluarTurnstile({ success: false, "error-codes": ["invalid-input-secret"] }, OPTS).razon === "invalid-input-secret", "evaluar: surface del error-code para telemetría");

// plantillaVerificacionRegistro: escape + enlace + validez.
const inj = plantillaVerificacionRegistro({ nombre: "<b>Ana</b>", negocioNombre: "<script>x</script>", enlace: "https://x/registro/confirmar?token=abc" });
ok(!inj.html.includes("<script>x</script>"), "plantilla: el negocio no inyecta <script> crudo");
ok(inj.html.includes("&lt;script&gt;"), "plantilla: el negocio va escapado");
ok(!inj.html.includes("<b>Ana</b>"), "plantilla: el nombre no inyecta <b> crudo");
ok(inj.html.includes("registro/confirmar?token=abc") && inj.texto.includes("registro/confirmar?token=abc"), "plantilla: enlace en HTML y texto");
ok(/24 h/.test(inj.texto), "plantilla: menciona validez de 24 h");
ok(inj.texto.toLowerCase().includes("no se creará ninguna cuenta"), "plantilla: nota de que no se crea cuenta si no fue el destinatario");
ok(inj.asunto.toLowerCase().includes("confirma tu registro"), "plantilla: asunto de confirmar registro");

console.log(fallos === 0 ? `\nOK — ${total} asserts pasan` : `\nCON FALLOS: ${fallos} de ${total}`);
process.exit(fallos === 0 ? 0 : 1);
