import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Boton } from './Boton';

export interface DialogoConfirmacionProps {
  abierto: boolean;
  titulo: string;
  mensaje: ReactNode;
  /** Detalle de lo que se borrará, una línea por elemento. */
  lineas?: string[];
  textoConfirmar?: string;
  /** Usa el botón rojo de peligro. */
  peligro?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

const FOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal propio de confirmación. Foco atrapado dentro, Esc y clic fuera cancelan,
 * el foco inicial va a "Cancelar" y al cerrar vuelve al elemento anterior.
 */
export function DialogoConfirmacion({
  abierto,
  titulo,
  mensaje,
  lineas,
  textoConfirmar = 'Confirmar',
  peligro = false,
  onConfirmar,
  onCancelar,
}: DialogoConfirmacionProps) {
  const idTitulo = useId();
  const idMensaje = useId();
  const dialogoRef = useRef<HTMLDivElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const cancelarActual = useRef(onCancelar);

  useEffect(() => {
    cancelarActual.current = onCancelar;
  }, [onCancelar]);

  useEffect(() => {
    if (!abierto) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelarRef.current?.focus();

    function alPresionar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelarActual.current();
      }
    }
    function alEnfocar(e: FocusEvent) {
      const dialogo = dialogoRef.current;
      if (dialogo && e.target instanceof Node && !dialogo.contains(e.target)) {
        cancelarRef.current?.focus();
      }
    }
    document.addEventListener('keydown', alPresionar);
    document.addEventListener('focusin', alEnfocar);
    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.removeEventListener('focusin', alEnfocar);
      document.body.style.overflow = overflowAnterior;
      anterior?.focus();
    };
  }, [abierto]);

  if (!abierto) return null;

  function atraparTab(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab' || !dialogoRef.current) return;
    const focables = Array.from(dialogoRef.current.querySelectorAll<HTMLElement>(FOCABLES));
    if (focables.length === 0) return;
    const primero = focables[0];
    const ultimo = focables[focables.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancelar();
      }}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idMensaje}
        onKeyDown={atraparTab}
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5"
      >
        <h2 id={idTitulo} className="text-lg font-semibold text-slate-900">
          {titulo}
        </h2>
        <div id={idMensaje} className="mt-2 text-sm text-slate-700">
          {mensaje}
        </div>
        {lineas && lineas.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {lineas.map((linea, i) => (
              <li key={`${i}-${linea}`}>{linea}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton ref={cancelarRef} variant="secundario" onClick={onCancelar}>
            Cancelar
          </Boton>
          <Boton variant={peligro ? 'peligro' : 'primario'} onClick={onConfirmar}>
            {textoConfirmar}
          </Boton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
