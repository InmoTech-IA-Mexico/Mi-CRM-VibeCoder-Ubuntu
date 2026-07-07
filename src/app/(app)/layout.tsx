import { MarcoApp } from "@/components/layout/marco-app";
import { SessionProvider } from "@/components/session/session-provider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[430px] flex-col">
      <SessionProvider>
        <MarcoApp>{children}</MarcoApp>
      </SessionProvider>
    </div>
  );
}
