// Plantillas de correo transaccional (JUA-129). Módulo PURO: funciones sin efectos
// ni dependencias de Convex/Node, testeables con `node --experimental-strip-types`
// (como `csv.ts`). `convex/email.ts` las consume desde el runtime Node.
//
// Seguridad de plantilla: TODO dato interpolado en el HTML (nombre, negocio) pasa
// por `escaparHtml` → sin inyección de HTML en el correo. El enlace lo compone el
// servidor desde `APP_BASE_URL` (base fija) + token hex → sin open redirect. Sin
// imágenes ni assets externos (los clientes de correo los bloquean).

export type Correo = { asunto: string; html: string; texto: string };

/**
 * Valida y normaliza `APP_BASE_URL` antes de componer enlaces que transportan tokens
 * (capacidades). Rechaza cadenas no parseables y orígenes no HTTPS (salvo
 * `http://localhost` / `127.0.0.1` para desarrollo). Devuelve SOLO el **origen**
 * (esquema+host+puerto) → descarta cualquier path/query/fragmento, de modo que una base
 * accidental o maliciosa no pueda inyectar nada en el `href`. `null` si es inválida:
 * entonces `flush` queda inerte y no reclama (no quema intentos).
 */
export function normalizarBaseUrl(raw: string | undefined | null): string | null {
  const s = raw?.trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  const esLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol === "https:" || (u.protocol === "http:" && esLocal)) return u.origin;
  return null;
}

/** Escapa entidades HTML para interpolar datos del usuario en el cuerpo del correo. */
export function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Envoltura común: párrafos + botón + nota. Estilos inline (los clientes de correo
// no aplican <style> ni clases). `parrafosHtml` YA viene escapado por quien llama.
function documentoHtml(parrafosHtml: string[], enlace: string, textoBoton: string, nota: string): string {
  const parrafos = parrafosHtml.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#2b2b2b">${p}</p>`).join("");
  // Defensa en profundidad: aunque el enlace se compone del origen normalizado + token hex
  // (sin comillas), se escapa al interpolarlo en el atributo `href` y en el cuerpo.
  const enlaceHtml = escaparHtml(enlace);
  return [
    '<div style="max-width:480px;margin:0 auto;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">',
    '<h1 style="margin:0 0 20px;font-size:20px;color:#0f3d3e">InmoTech IA México</h1>',
    parrafos,
    `<p style="margin:24px 0"><a href="${enlaceHtml}" style="display:inline-block;background:#c9a227;color:#1a1a1a;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${textoBoton}</a></p>`,
    `<p style="margin:0 0 8px;font-size:13px;color:#6b6b6b">${nota}</p>`,
    `<p style="margin:0;font-size:12px;color:#9a9a9a">Si el botón no funciona, copia y pega este enlace:<br>${enlaceHtml}</p>`,
    "</div>",
  ].join("");
}

function documentoTexto(parrafos: string[], enlace: string, nota: string): string {
  return [...parrafos, "", enlace, "", nota, "", "— InmoTech IA México"].join("\n");
}

/**
 * Invitación / activación del primer admin (JUA-8/9, JUA-41). Enlace `/activar?token=`,
 * válido 7 días. Copy sensible al rol (admin administra el negocio; el resto colabora).
 */
export function plantillaInvitacion(datos: {
  nombre?: string | null;
  negocioNombre?: string | null;
  rol: string;
  enlace: string;
}): Correo {
  const negocio = datos.negocioNombre?.trim() || "tu negocio";
  const negocioHtml = escaparHtml(negocio);
  const saludoTxt = datos.nombre?.trim() ? `Hola ${datos.nombre.trim()},` : "Hola,";
  const saludoHtml = datos.nombre?.trim() ? `Hola ${escaparHtml(datos.nombre.trim())},` : "Hola,";
  const accion =
    datos.rol === "admin"
      ? `Te damos acceso para administrar <strong>${negocioHtml}</strong> en InmoTech IA México.`
      : `Te invitaron a colaborar en <strong>${negocioHtml}</strong> en InmoTech IA México.`;
  const accionTxt =
    datos.rol === "admin"
      ? `Te damos acceso para administrar ${negocio} en InmoTech IA México.`
      : `Te invitaron a colaborar en ${negocio} en InmoTech IA México.`;
  const nota = "El enlace es válido 7 días y solo puede usarse una vez.";
  return {
    asunto: `Activa tu cuenta en InmoTech IA — ${negocio}`,
    html: documentoHtml([saludoHtml, accion, "Activa tu cuenta y crea tu contraseña para entrar:"], datos.enlace, "Activar mi cuenta", nota),
    texto: documentoTexto([saludoTxt, accionTxt, "Activa tu cuenta y crea tu contraseña para entrar:"], datos.enlace, nota),
  };
}

/**
 * Recuperación de contraseña (JUA-7) y nueva contraseña al reactivar (JUA-125).
 * Enlace `/nueva-password?token=`, válido 24 h, un solo uso. `esReactivacion`
 * cambia el copy (el reactivar no nació de una solicitud del propio usuario).
 */
export function plantillaRecuperacion(datos: { enlace: string; esReactivacion?: boolean }): Correo {
  if (datos.esReactivacion) {
    const p = ["Hola,", "Un administrador reactivó tu acceso a InmoTech IA México.", "Crea una nueva contraseña para volver a entrar:"];
    const nota = "El enlace es válido 24 horas y solo puede usarse una vez.";
    return {
      asunto: "Tu acceso se reactivó — InmoTech IA",
      html: documentoHtml(p, datos.enlace, "Crear contraseña", nota),
      texto: documentoTexto(p, datos.enlace, nota),
    };
  }
  const p = ["Hola,", "Recibimos una solicitud para restablecer tu contraseña de InmoTech IA México.", "Crea una nueva contraseña aquí:"];
  const nota = "El enlace es válido 24 horas y solo puede usarse una vez. Si no lo solicitaste, ignora este correo: tu contraseña no cambia.";
  return {
    asunto: "Restablece tu contraseña — InmoTech IA",
    html: documentoHtml(p, datos.enlace, "Crear nueva contraseña", nota),
    texto: documentoTexto(p, datos.enlace, nota),
  };
}
