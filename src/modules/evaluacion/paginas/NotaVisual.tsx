import type { Escala } from '@/core/tipos';
import { formatoNota, formatoNumero } from '@/modules/evaluacion/notas';
import { decimalesDe } from '@/modules/evaluacion/calculo';

/**
 * Nota calculada (periodo o definitiva). En escala por letras muestra la letra
 * y, en pequeño, el número equivalente (4,20).
 */
export function NotaVisual({ valor, escala }: { valor: number; escala: Escala }) {
  if (escala.tipo === 'numerica') return <span>{formatoNota(valor, escala)}</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="font-medium">{formatoNota(valor, escala)}</span>{' '}
      <span className="text-xs text-slate-500">{formatoNumero(valor, decimalesDe(escala))}</span>
    </span>
  );
}
