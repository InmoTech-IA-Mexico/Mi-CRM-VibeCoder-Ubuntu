import type { Metadata } from "next";
import { PantallaConfirmarRegistro } from "./_components/pantalla-confirmar-registro";

// Confirmación del registro público (JUA-39). Ruta pública sin sesión (grupo `(auth)`, sin
// SessionProvider — control 5). `noindex`. Next 16: searchParams es asíncrono (leído en el
// servidor y pasado como prop, SSR-safe).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <PantallaConfirmarRegistro token={token ?? ""} />;
}
