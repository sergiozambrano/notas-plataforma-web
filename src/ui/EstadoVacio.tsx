import type { ReactNode } from 'react';

export interface EstadoVacioProps {
  titulo: string;
  descripcion?: ReactNode;
  accion?: ReactNode;
}

/** Lista o sección sin datos, con una acción sugerida opcional. */
export function EstadoVacio({ titulo, descripcion, accion }: EstadoVacioProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
      <p className="font-medium text-slate-900">{titulo}</p>
      {descripcion ? <div className="mt-1 text-sm text-slate-600">{descripcion}</div> : null}
      {accion ? <div className="mt-4 flex flex-wrap justify-center gap-2">{accion}</div> : null}
    </div>
  );
}
