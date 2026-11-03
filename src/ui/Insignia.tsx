import type { ReactNode } from 'react';

export type TonoInsignia = 'neutro' | 'exito' | 'advertencia' | 'peligro' | 'info';

const TONOS: Record<TonoInsignia, string> = {
  neutro: 'bg-slate-100 text-slate-700 border-slate-300',
  exito: 'bg-teal-50 text-teal-800 border-teal-300',
  advertencia: 'bg-amber-50 text-amber-900 border-amber-300',
  peligro: 'bg-red-50 text-red-800 border-red-300',
  info: 'bg-slate-50 text-slate-800 border-slate-400',
};

export interface InsigniaProps {
  tono?: TonoInsignia;
  /** Clases extra, por ejemplo `self-start` dentro de un contenedor flex-col. */
  className?: string;
  children: ReactNode;
}

/** Etiqueta corta de estado, por ejemplo "Aprueba", "Pendiente" o "Finalizado". */
export function Insignia({ tono = 'neutro', className = '', children }: InsigniaProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONOS[tono]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
