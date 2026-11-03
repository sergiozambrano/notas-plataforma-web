import type { ReactNode } from 'react';

export interface TarjetaProps {
  titulo?: ReactNode;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Bloque con borde suave para agrupar contenido. */
export function Tarjeta({ titulo, acciones, children, className = '' }: TarjetaProps) {
  return (
    <section className={`min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 ${className}`}>
      {titulo || acciones ? (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo ? <h2 className="text-base font-semibold text-slate-900">{titulo}</h2> : null}
          {acciones}
        </header>
      ) : null}
      {children}
    </section>
  );
}
