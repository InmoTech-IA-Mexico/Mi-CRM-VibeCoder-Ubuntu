"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : null;

/**
 * Envuelve la app con el cliente de Convex.
 * Si aún no hay despliegue configurado (NEXT_PUBLIC_CONVEX_URL vacío), la app
 * arranca igualmente sin conexión — enlaza Convex con `npx convex dev`.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!client) return <>{children}</>;
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
