export interface CargandoProps {
  texto?: string;
}

/** Indicador de carga en texto, anunciado a lectores de pantalla. */
export function Cargando({ texto = 'Cargando…' }: CargandoProps) {
  return (
    <p role="status" className="py-8 text-center text-sm text-slate-600">
      {texto}
    </p>
  );
}
