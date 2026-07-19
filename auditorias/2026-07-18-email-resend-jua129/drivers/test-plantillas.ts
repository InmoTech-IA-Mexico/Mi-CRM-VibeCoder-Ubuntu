// Unit test del módulo PURO de plantillas (JUA-129). Sin Convex ni red:
//   node --experimental-strip-types tmp/drivers-jua129/test-plantillas.ts
import {
  escaparHtml,
  normalizarBaseUrl,
  normalizarRemitente,
  clasificarRespuestaEnvio,
  plantillaInvitacion,
  plantillaRecuperacion,
} from "../../convex/emailPlantillas.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  console.log((cond ? "PASS" : "FAIL") + " — " + msg);
  if (!cond) fallos++;
}

// -1) normalizarRemitente: exige un correo válido; acepta "Nombre <correo>".
ok(normalizarRemitente("InmoTech IA <no-reply@inmotech.mx>") === "InmoTech IA <no-reply@inmotech.mx>", "remitente: 'Nombre <correo>' válido");
ok(normalizarRemitente("onboarding@resend.dev") === "onboarding@resend.dev", "remitente: correo suelto válido");
ok(normalizarRemitente("InmoTech sin correo") === null, "remitente: sin correo → null");
ok(normalizarRemitente("") === null && normalizarRemitente(undefined) === null, "remitente: vacío/undefined → null (flush inerte)");

// -0.5) clasificarRespuestaEnvio: config (401/403) NO es terminal; otros 4xx sí; 429/5xx transitorio.
ok(clasificarRespuestaEnvio(200) === "ok" && clasificarRespuestaEnvio(202) === "ok", "clasificar: 2xx → ok");
ok(clasificarRespuestaEnvio(401) === "config" && clasificarRespuestaEnvio(403) === "config", "clasificar: 401/403 → config (no descarta)");
ok(clasificarRespuestaEnvio(400) === "terminal" && clasificarRespuestaEnvio(422) === "terminal", "clasificar: otros 4xx → terminal");
ok(clasificarRespuestaEnvio(429) === "transitorio" && clasificarRespuestaEnvio(500) === "transitorio" && clasificarRespuestaEnvio(503) === "transitorio", "clasificar: 429/5xx → transitorio");

// 0) normalizarBaseUrl: acepta HTTPS y http://localhost; rechaza el resto; solo el origen.
ok(normalizarBaseUrl("https://app.example.com") === "https://app.example.com", "baseUrl: https válido → origen");
ok(normalizarBaseUrl("https://app.example.com/algo?x=1#h") === "https://app.example.com", "baseUrl: descarta path/query/fragmento (solo origen)");
ok(normalizarBaseUrl("http://localhost:3000") === "http://localhost:3000", "baseUrl: http://localhost permitido (dev)");
ok(normalizarBaseUrl("http://app.example.com") === null, "baseUrl: http no-local rechazado");
ok(normalizarBaseUrl("no-es-una-url") === null, "baseUrl: cadena no parseable rechazada");
ok(normalizarBaseUrl("") === null && normalizarBaseUrl(undefined) === null, "baseUrl: vacío/undefined → null");
ok(normalizarBaseUrl('https://evil.com/"><script>') === "https://evil.com", "baseUrl: intento de inyección → solo origen limpio");

// 1) escaparHtml neutraliza los metacaracteres HTML.
ok(escaparHtml(`<script>&"'`) === "&lt;script&gt;&amp;&quot;&#39;", "escaparHtml escapa < > & \" '");
ok(escaparHtml("Ana & Co") === "Ana &amp; Co", "escaparHtml preserva texto normal");

// 2) Inyección de HTML por el nombre/negocio: el cuerpo NO contiene el <script> crudo.
const inv = plantillaInvitacion({
  nombre: `<script>alert(1)</script>`,
  negocioNombre: `Inmo <b>X</b>`,
  rol: "operativo",
  enlace: "https://app.example.com/activar?token=abc123",
});
ok(!inv.html.includes("<script>alert(1)</script>"), "invitacion: el nombre no inyecta <script> crudo en el HTML");
ok(inv.html.includes("&lt;script&gt;"), "invitacion: el nombre va escapado");
ok(!inv.html.includes("Inmo <b>X</b>"), "invitacion: el negocio no inyecta <b> crudo");
ok(inv.html.includes("https://app.example.com/activar?token=abc123"), "invitacion: el enlace aparece en el HTML");
ok(inv.texto.includes("https://app.example.com/activar?token=abc123"), "invitacion: el enlace aparece en el texto plano");
ok(/7 d[ií]as/.test(inv.texto), "invitacion: menciona validez de 7 días");

// 3) Copy sensible al rol.
const invAdmin = plantillaInvitacion({ nombre: "Marta", negocioNombre: "InmoX", rol: "admin", enlace: "https://x/activar?token=t" });
ok(invAdmin.html.includes("administrar"), "invitacion admin: copy de administrar");

// 4) Recuperación vs reactivación: asuntos distintos, ambos con enlace y 24 h.
const rec = plantillaRecuperacion({ enlace: "https://x/nueva-password?token=r1" });
const rea = plantillaRecuperacion({ enlace: "https://x/nueva-password?token=r2", esReactivacion: true });
ok(rec.asunto !== rea.asunto, "recuperacion y reactivacion tienen asuntos distintos");
ok(rec.asunto.toLowerCase().includes("restablece"), "recuperacion: asunto de restablecer");
ok(rea.asunto.toLowerCase().includes("reactiv"), "reactivacion: asunto de reactivación");
ok(rec.html.includes("nueva-password?token=r1") && rec.texto.includes("nueva-password?token=r1"), "recuperacion: enlace en HTML y texto");
ok(/24 h/.test(rec.texto), "recuperacion: menciona 24 h");
ok(rec.texto.toLowerCase().includes("ignora"), "recuperacion: nota anti-phishing (ignora si no fuiste tú)");

console.log(fallos === 0 ? "\nOK — todos los asserts de plantilla pasan" : `\nCON FALLOS: ${fallos}`);
process.exit(fallos === 0 ? 0 : 1);
