import type { ReactNode } from 'react';

export type TipoAviso = 'error' | 'exito' | 'info' | 'advertencia';

const ESTILOS: Record<TipoAviso, string> = {
  error: 'border-red-300 bg-red-50 text-red-900',
  exito: 'border-teal-300 bg-teal-50 text-teal-900',
  info: 'border-slate-300 bg-slate-100 text-slate-800',
  advertencia: 'border-amber-300 bg-amber-50 text-amber-900',
};

export interface AvisoProps {
  tipo?: TipoAviso;
  titulo?: string;
  children: ReactNode;
  className?: string;
}

/** Mensaje visible para errores de negocio, éxitos y advertencias. role="alert" para lectores de pantalla. */
export function Aviso({ tipo = 'info', titulo, children, className = '' }: AvisoProps) {
  return (
    <div role="alert" className={`rounded-md border px-4 py-3 text-sm ${ESTILOS[tipo]} ${className}`}>
      {titulo ? <p className="font-semibold">{titulo}</p> : null}
      <div>{children}</div>
    </div>
  );
}
