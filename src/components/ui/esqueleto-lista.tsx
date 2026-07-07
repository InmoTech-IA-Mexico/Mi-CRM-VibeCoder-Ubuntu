/** Placeholder de carga (skeleton) para listas de tarjetas. */
export function EsqueletoLista({ filas = 3 }: { filas?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: filas }).map((_, i) => (
        <div
          key={i}
          className="h-[70px] animate-pulse rounded-card border border-neutral-100 bg-neutral-50"
        />
      ))}
    </div>
  );
}
