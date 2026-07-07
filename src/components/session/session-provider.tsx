"use client";

import { createContext, useCallback, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

// Sesión del usuario actual.
//
// TODO(JUA-6/JUA-30): mientras no exista login, la sesión se resuelve con la
// query `sesion.actual` (primer negocio + sus usuarios) y el usuario activo se
// guarda en localStorage. El menú de perfil ofrece un conmutador (dev) para
// alternar de rol. Sustituir por autenticación real.

export type Sesion = {
  negocio: Doc<"negocios">;
  usuario: Doc<"usuarios">;
  rol: Doc<"usuarios">["rol"];
  usuarios: Doc<"usuarios">[];
  setUsuarioActivo: (id: Id<"usuarios">) => void;
};

export const SessionContext = createContext<Sesion | null>(null);

const CLAVE_LS = "sesion.usuarioActivoId";

export function SessionProvider({ children }: { children: ReactNode }) {
  const datos = useQuery(api.sesion.actual);
  // Usuario activo persistido en localStorage (inicializador perezoso, seguro
  // en SSR). Mientras Convex carga se muestra "Cargando…", así no hay desajuste
  // de hidratación por este valor.
  const [usuarioActivoId, setUsuarioActivoId] = useState<Id<"usuarios"> | null>(
    () =>
      typeof window === "undefined"
        ? null
        : (window.localStorage.getItem(CLAVE_LS) as Id<"usuarios"> | null),
  );

  const setUsuarioActivo = useCallback((id: Id<"usuarios">) => {
    setUsuarioActivoId(id);
    window.localStorage.setItem(CLAVE_LS, id);
  }, []);

  const valor = useMemo<Sesion | null>(() => {
    if (!datos || datos.usuarios.length === 0) return null;
    const { negocio, usuarios } = datos;
    const usuario =
      usuarios.find((u) => u._id === usuarioActivoId) ??
      usuarios.find((u) => u.rol === "admin") ??
      usuarios[0];
    return { negocio, usuario, rol: usuario.rol, usuarios, setUsuarioActivo };
  }, [datos, usuarioActivoId, setUsuarioActivo]);

  if (datos === undefined) {
    return (
      <div className="flex min-h-full items-center justify-center p-8 text-sm text-muted">
        Cargando…
      </div>
    );
  }

  if (valor === null) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="font-serif text-lg text-ink">Sin datos todavía</p>
        <p className="text-sm text-body">
          Ejecuta el seed para poblar el negocio de demostración:
        </p>
        <code className="rounded-input bg-neutral-50 px-3 py-1.5 text-sm text-gold-text">
          npx convex run seed:poblarDemo
        </code>
      </div>
    );
  }

  return <SessionContext.Provider value={valor}>{children}</SessionContext.Provider>;
}
