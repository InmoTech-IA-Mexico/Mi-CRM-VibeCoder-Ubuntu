import { BottomNav } from "@/components/layout/bottom-nav";
import { BotonFlotante } from "@/components/layout/boton-flotante";
import { SessionProvider } from "@/components/session/session-provider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[430px] flex-col">
      <SessionProvider>
        <main className="flex-1 pb-24">{children}</main>
        <BotonFlotante />
        <BottomNav />
      </SessionProvider>
    </div>
  );
}
