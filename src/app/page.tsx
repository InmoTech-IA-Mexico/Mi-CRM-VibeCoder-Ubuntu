import { redirect } from "next/navigation";

// El primer acceso siempre pasa por Login (PRD · Navegación).
export default function RootPage() {
  redirect("/login");
}
