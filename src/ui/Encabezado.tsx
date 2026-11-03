import type { ReactNode } from 'react';

export interface EncabezadoProps {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
}

/** Título principal de cada página, con descripción y acciones opcionales. */
export function Encabezado({ titulo, descripcion, acciones }: EncabezadoProps) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-xl font-semibold text-slate-900 sm:text-2xl">{titulo}</h1>
        {descripcion ? <div className="mt-1 text-sm text-slate-600">{descripcion}</div> : null}
      </div>
      {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
    </header>
  );
}
