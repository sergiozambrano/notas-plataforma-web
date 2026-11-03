import { useCallback, useRef, useState, type ReactNode } from 'react';
import { DialogoConfirmacion } from './DialogoConfirmacion';

export interface OpcionesConfirmacion {
  titulo: string;
  mensaje: ReactNode;
  lineas?: string[];
  textoConfirmar?: string;
  peligro?: boolean;
}

export interface UseConfirmacion {
  /** Abre el diálogo y resuelve true si el docente confirma, false si cancela. */
  pedir: (opciones: OpcionesConfirmacion) => Promise<boolean>;
  /** Debe renderizarse una vez en la página que usa `pedir`. */
  dialogo: ReactNode;
}

/**
 * Confirmación con el diálogo propio de la app (nunca confirm del navegador).
 * Uso: `const { pedir, dialogo } = useConfirmacion();` y, en el JSX, `{dialogo}`.
 */
export function useConfirmacion(): UseConfirmacion {
  const [opciones, setOpciones] = useState<OpcionesConfirmacion | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const pedir = useCallback(
    (nuevas: OpcionesConfirmacion) =>
      new Promise<boolean>((resolver) => {
        resolverRef.current?.(false);
        resolverRef.current = resolver;
        setOpciones(nuevas);
      }),
    [],
  );

  const responder = useCallback((ok: boolean) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setOpciones(null);
    resolver?.(ok);
  }, []);

  const dialogo = (
    <DialogoConfirmacion
      abierto={opciones !== null}
      titulo={opciones?.titulo ?? ''}
      mensaje={opciones?.mensaje ?? ''}
      lineas={opciones?.lineas}
      textoConfirmar={opciones?.textoConfirmar}
      peligro={opciones?.peligro}
      onConfirmar={() => responder(true)}
      onCancelar={() => responder(false)}
    />
  );

  return { pedir, dialogo };
}
