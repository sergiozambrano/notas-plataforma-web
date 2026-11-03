import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';

export interface PestanaItem {
  id: string;
  etiqueta: string;
}

export interface PestanasProps {
  items: PestanaItem[];
  activa: string;
  onCambiar: (id: string) => void;
  /** Nombre accesible del grupo de pestañas. */
  etiqueta: string;
}

/**
 * Pestañas controladas: la página decide qué contenido mostrar según `activa`.
 * Flechas, Inicio y Fin mueven el foco entre pestañas.
 */
export function Pestanas({ items, activa, onCambiar, etiqueta }: PestanasProps) {
  const botones = useRef<(HTMLButtonElement | null)[]>([]);

  function alTeclear(e: ReactKeyboardEvent<HTMLButtonElement>, indice: number) {
    let siguiente: number | null = null;
    if (e.key === 'ArrowRight') siguiente = (indice + 1) % items.length;
    if (e.key === 'ArrowLeft') siguiente = (indice - 1 + items.length) % items.length;
    if (e.key === 'Home') siguiente = 0;
    if (e.key === 'End') siguiente = items.length - 1;
    if (siguiente === null) return;
    e.preventDefault();
    onCambiar(items[siguiente].id);
    botones.current[siguiente]?.focus();
  }

  return (
    <div role="tablist" aria-label={etiqueta} className="flex flex-wrap gap-1 border-b border-slate-200">
      {items.map((item, indice) => {
        const seleccionada = item.id === activa;
        return (
          <button
            key={item.id}
            ref={(el) => {
              botones.current[indice] = el;
            }}
            type="button"
            role="tab"
            aria-selected={seleccionada}
            tabIndex={seleccionada ? 0 : -1}
            onClick={() => onCambiar(item.id)}
            onKeyDown={(e) => alTeclear(e, indice)}
            className={`min-h-10 border-b-2 px-3 py-2 text-sm font-medium ${
              seleccionada ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
