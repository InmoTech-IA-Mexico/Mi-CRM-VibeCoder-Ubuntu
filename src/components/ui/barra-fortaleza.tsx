import { cn } from "@/lib/utils";

// Barra de fortaleza de contraseña (JUA-124): 4 segmentos con 4 niveles. Se usa en
// los flujos donde se CREA/cambia contraseña (activación, recuperación, perfil).
// La política mínima (≥8 caracteres) la valida cada pantalla; por debajo del mínimo
// el nivel es siempre "Débil".

export type NivelFortaleza = 0 | 1 | 2 | 3 | 4; // 0 = vacío (no se muestra)

/** Puntúa la contraseña por longitud y variedad de tipos de carácter. */
export function fortalezaPassword(p: string): NivelFortaleza {
  if (!p) return 0;
  if (p.length < 8) return 1; // por debajo del mínimo → Débil
  let clases = 0;
  if (/[a-z]/.test(p)) clases++;
  if (/[A-Z]/.test(p)) clases++;
  if (/\d/.test(p)) clases++;
  if (/[^A-Za-z0-9]/.test(p)) clases++;
  let score = 1; // ya cumple el mínimo de 8
  if (clases >= 2) score++;
  if (clases >= 3 || p.length >= 12) score++;
  if (clases >= 3 && p.length >= 12) score++;
  return Math.min(4, score) as NivelFortaleza;
}

const NIVELES: Record<1 | 2 | 3 | 4, { label: string; barra: string; texto: string }> = {
  1: { label: "Débil", barra: "bg-danger", texto: "text-danger" },
  2: { label: "Media", barra: "bg-gold-500", texto: "text-gold-700" },
  3: { label: "Fuerte", barra: "bg-teal-800", texto: "text-teal-800" },
  4: { label: "Muy fuerte", barra: "bg-success", texto: "text-success" },
};

export function BarraFortaleza({ password, className }: { password: string; className?: string }) {
  const nivel = fortalezaPassword(password);
  if (nivel === 0) return null;
  const n = NIVELES[nivel];
  return (
    <div
      className={cn("mt-2 flex items-center gap-2", className)}
      role="status"
      aria-live="polite"
      aria-label={`Fortaleza de la contraseña: ${n.label}`}
    >
      <div className="flex h-1.5 flex-1 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("h-full flex-1 rounded-full transition-colors", i <= nivel ? n.barra : "bg-neutral-200")}
          />
        ))}
      </div>
      <span className={cn("min-w-[62px] text-right text-[11.5px] font-semibold", n.texto)}>{n.label}</span>
    </div>
  );
}
