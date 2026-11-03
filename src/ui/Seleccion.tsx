import { forwardRef, type SelectHTMLAttributes } from 'react';
import { descripcionCampo, useCampo } from './Campo';

/** Lista desplegable. Dentro de un <Campo> toma id, aria-invalid y aria-describedby. */
export const Seleccion = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Seleccion(
  { className = '', id, 'aria-describedby': descrito, children, ...resto },
  ref,
) {
  const campo = useCampo();
  return (
    <select
      ref={ref}
      id={id ?? campo?.id}
      aria-invalid={campo?.tieneError || undefined}
      aria-describedby={descripcionCampo(campo, descrito)}
      className={`min-h-10 w-full min-w-0 truncate rounded-md border bg-white px-3 py-2 text-base text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 ${
        campo?.tieneError ? 'border-red-600' : 'border-slate-300'
      } ${className}`}
      {...resto}
    >
      {children}
    </select>
  );
});
