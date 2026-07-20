// Lectura ACOTADA del cuerpo de una petición pública (JUA-39, remediación B-1 de implementación).
// Cuenta bytes por fragmento y aborta si supera el máximo ANTES de decodificar/parsear, para que
// un cuerpo enorme no consuma memoria/CPU antes de Turnstile. Rechaza temprano por `Content-Length`
// si ya lo supera, pero NO confía solo en ese header (lo verifica leyendo). Devuelve `null` si
// excede o falla la lectura (fail-closed). Pura y testeable con un `ReadableStream` construido.

export async function leerCuerpoAcotado(
  body: ReadableStream<Uint8Array> | null,
  max: number,
  contentLength: string | null,
): Promise<string | null> {
  if (contentLength) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > max) return null; // rechazo temprano (no se confía solo en esto)
  }
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > max) {
          await reader.cancel();
          return null; // supera el máximo real → 413
        }
        chunks.push(value);
      }
    }
  } catch {
    return null; // error de lectura → fail-closed
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}
