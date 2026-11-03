import { Link } from 'react-router-dom';
import { EstadoVacio } from './EstadoVacio';

export interface SinPermisoProps {
  mensaje?: string;
}

/** Pantalla de acceso denegado (ErrorAcceso): el recurso es ajeno o no existe. */
export function SinPermiso({ mensaje = 'El recurso no existe o no es tuyo.' }: SinPermisoProps) {
  return (
    <EstadoVacio
      titulo="No tienes permiso para ver este recurso"
      descripcion={mensaje}
      accion={
        <Link
          to="/panel"
          className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          Ir al panel
        </Link>
      }
    />
  );
}
