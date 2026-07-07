"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users } from "lucide-react";
import { cn } from "@/lib/utils";

// Navegación principal (JUA-27): dos únicos puntos de entrada fijos. El resto
// (perfil/ajustes) vive en el menú de perfil del header; crear cliente, en el FAB.
const TABS = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/clientes", label: "Clientes", icon: Users },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[430px] items-stretch border-t border-neutral-100 bg-surface/95 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-1 text-[10.5px] font-medium",
              active ? "text-teal-800" : "text-muted",
            )}
          >
            <Icon size={22} strokeWidth={active ? 2 : 1.7} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
