import type { ReactNode } from "react";

/**
 * Marcador de pantalla por construir. Cada ruta lo usa como punto de partida
 * y apunta al diseño exacto (`.dc.html`) y su issue de Linear.
 */
export function ScreenPlaceholder({
  title,
  design,
  issue,
  children,
}: {
  title: string;
  design?: string;
  issue?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-ink">{title}</h1>
        {(design || issue) && (
          <p className="mt-1 text-sm text-muted">
            {design && (
              <>
                Diseño: <code className="text-gold-text">{design}</code>
              </>
            )}
            {design && issue && " · "}
            {issue && <>Linear: {issue}</>}
          </p>
        )}
      </header>
      <div className="rounded-card border border-neutral-100 bg-surface p-5 text-body shadow-sm">
        {children ?? (
          <p>
            Pantalla por construir. Reproduce el prototipo de{" "}
            <code className="text-gold-text">{design}</code> con los tokens de{" "}
            <code>globals.css</code>.
          </p>
        )}
      </div>
    </div>
  );
}
