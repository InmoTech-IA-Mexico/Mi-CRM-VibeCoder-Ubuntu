import { PantallaNuevaPassword } from "./_components/pantalla-nueva-password";

// Token vía searchParams del server (SSR-safe) → sin mismatch de hidratación.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <PantallaNuevaPassword token={token ?? ""} />;
}
