import { forwardRef, type InputHTMLAttributes } from 'react';
import { descripcionCampo, useCampo } from './Campo';

/** Campo de texto. Dentro de un <Campo> toma id, aria-invalid y aria-describedby. */
export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Entrada(
  { className = '', id, 'aria-describedby': descrito, ...resto },
  ref,
) {
  const campo = useCampo();
  return (
    <input
      ref={ref}
      id={id ?? campo?.id}
      aria-invalid={campo?.tieneError || undefined}
      aria-describedby={descripcionCampo(campo, descrito)}
      className={`min-h-10 w-full min-w-0 rounded-md border bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-500 ${
        campo?.tieneError ? 'border-red-600' : 'border-slate-300'
      } ${className}`}
      {...resto}
    />
  );
});
