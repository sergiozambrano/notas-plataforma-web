import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorSesion } from '@/core/errores';

export interface RecursoEstado<T> {
  datos: T | null;
  cargando: boolean;
  error: Error | null;
  recargar: () => void;
}

/**
 * Carga un recurso con un servicio. Se vuelve a cargar cuando cambian `deps` o
 * al llamar `recargar()`. Mientras recarga conserva los datos anteriores.
 * Si el error es ErrorSesion, redirige a /iniciar-sesion. Los errores de acceso
 * (ErrorAcceso) se devuelven en `error` para mostrar <SinPermiso />.
 */
export function useRecurso<T>(cargar: () => Promise<T>, deps: DependencyList): RecursoEstado<T> {
  const navegar = useNavigate();
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    cargar().then(
      (resultado) => {
        if (!vigente) return;
        setDatos(resultado);
        setCargando(false);
      },
      (motivo: unknown) => {
        if (!vigente) return;
        if (motivo instanceof ErrorSesion) {
          navegar('/iniciar-sesion', { replace: true });
          return;
        }
        setError(motivo instanceof Error ? motivo : new Error(String(motivo)));
        setCargando(false);
      },
    );
    return () => {
      vigente = false;
    };
    // Las dependencias las pasa quien llama; `version` fuerza la recarga.
  }, [version, ...deps]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { datos, cargando, error, recargar };
}
