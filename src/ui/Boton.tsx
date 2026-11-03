import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma';

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: VarianteBoton;
}

const VARIANTES: Record<VarianteBoton, string> = {
  primario: 'border-teal-700 bg-teal-700 text-white hover:bg-teal-800',
  secundario: 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100',
  peligro: 'border-red-700 bg-red-700 text-white hover:bg-red-800',
  fantasma: 'border-transparent bg-transparent text-teal-800 hover:bg-slate-100',
};

/** Botón con altura táctil mínima de 40 px. `type` es "button" por defecto: usa type="submit" en los envíos. */
export const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  { variant = 'primario', className = '', type = 'button', ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variant]} ${className}`}
      {...resto}
    />
  );
});
