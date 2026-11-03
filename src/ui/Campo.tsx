import { createContext, useContext, useId, type ReactNode } from 'react';

/** Datos que Campo comparte con su control (Entrada o Seleccion) para la accesibilidad. */
export interface CampoInfo {
  id: string;
  errorId: string;
  hintId: string;
  tieneError: boolean;
  tieneHint: boolean;
}

const CampoContexto = createContext<CampoInfo | null>(null);

export function useCampo(): CampoInfo | null {
  return useContext(CampoContexto);
}

/** Une los ids de descripción del campo (ayuda y error) con otros ids extra. */
export function descripcionCampo(campo: CampoInfo | null, extra?: string): string | undefined {
  const ids = [
    extra,
    campo?.tieneHint ? campo.hintId : undefined,
    campo?.tieneError ? campo.errorId : undefined,
  ].filter((x): x is string => Boolean(x));
  return ids.length > 0 ? ids.join(' ') : undefined;
}

export interface CampoProps {
  label: ReactNode;
  error?: string | null;
  hint?: string;
  /** Id del control. Si se omite, se genera uno y el control lo toma del contexto. */
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Envoltorio de un control de formulario: label asociado, texto de ayuda y
 * error. El control hijo (Entrada o Seleccion) recibe id, aria-invalid y
 * aria-describedby automáticamente.
 */
export function Campo({ label, error, hint, htmlFor, children, className = '' }: CampoProps) {
  const generado = useId();
  const id = htmlFor ?? generado;
  const info: CampoInfo = {
    id,
    errorId: `${id}-error`,
    hintId: `${id}-ayuda`,
    tieneError: Boolean(error),
    tieneHint: Boolean(hint),
  };
  return (
    <CampoContexto.Provider value={info}>
      <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {children}
        {hint ? <p id={info.hintId} className="text-xs text-slate-600">{hint}</p> : null}
        {error ? <p id={info.errorId} className="text-sm text-red-700">{error}</p> : null}
      </div>
    </CampoContexto.Provider>
  );
}
