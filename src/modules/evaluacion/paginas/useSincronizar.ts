import { useEffect, useRef } from 'react';
import { useApp } from '@/layout/ContextoApp';

/**
 * Para rutas con id: cuando el recurso cargado pertenece a otro perfil o año,
 * fija el selector una sola vez para ese par. La clave guardada evita bucles.
 */
export function useSincronizar(perfilId: string | undefined, anioId: string | undefined): void {
  const app = useApp();
  const sincronizadoPara = useRef<string | null>(null);

  useEffect(() => {
    if (!perfilId || !anioId) return;
    const clave = `${perfilId}:${anioId}`;
    if (sincronizadoPara.current === clave) return;
    sincronizadoPara.current = clave;
    if (app.perfil?.id === perfilId && app.anio?.id === anioId) return;
    void app.sincronizar(perfilId, anioId);
    // Solo depende de los ids: `app` cambia en cada render del contexto.
  }, [perfilId, anioId]);
}
