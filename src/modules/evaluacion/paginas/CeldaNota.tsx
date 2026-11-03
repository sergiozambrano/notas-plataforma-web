import { useRef, useState } from 'react';
import type { Actividad, Escala, Estudiante, ValorNota } from '@/core/tipos';
import { mensajeError } from '@/ui';
import { guardarNota } from '@/modules/evaluacion/evaluacion.servicio';
import { formatoNotaRegistrada } from '@/modules/evaluacion/notas';
import {
  claveCelda, errorDeCelda, fijarErrorCelda, quitarErrorCelda,
} from './erroresNota';
import { nombreEstudiante } from './comun';

export interface CeldaNotaProps {
  asignacionId: string;
  periodoId: string;
  actividad: Actividad;
  estudiante: Estudiante;
  /** Nota guardada; undefined = sin nota. */
  valor: ValorNota | undefined;
  escala: Escala;
  /** Periodo mal configurado: no se pueden registrar notas. */
  deshabilitada: boolean;
  /** Solo consulta (periodo finalizado, perfil inactivo o año anterior). */
  soloLectura: boolean;
  /** Avisa a la planilla tras cada intento (true = guardado, false = error). */
  onResultado: (exito: boolean) => void;
}

/**
 * Celda de nota. Guarda al salir de la celda o con Enter, solo si el texto cambió
 * desde el último intento. No recarga la planilla: mantiene su borrador local.
 */
export function CeldaNota(props: CeldaNotaProps) {
  const {
    asignacionId, periodoId, actividad, estudiante, valor, escala, deshabilitada, soloLectura, onResultado,
  } = props;
  const clave = claveCelda(asignacionId, periodoId, actividad.id, estudiante.id);
  const ruta = `/planilla/${asignacionId}/${periodoId}`;
  const nombre = nombreEstudiante(estudiante);
  const etiqueta = `${nombre} — ${actividad.nombre}`;
  const errorActual = errorDeCelda(clave)?.mensaje ?? null;

  const [texto, setTexto] = useState<string>(() => {
    const pendiente = errorDeCelda(clave);
    if (pendiente) return pendiente.texto;
    return valor === undefined ? '' : formatoNotaRegistrada(valor, escala);
  });
  const textoRef = useRef(texto);
  // Último texto enviado (o mostrado tras guardar): evita reenvíos sin cambios.
  const intentado = useRef(texto);
  const enVuelo = useRef(false);
  const repetir = useRef(false);
  const [guardando, setGuardando] = useState(false);

  async function guardar(): Promise<void> {
    if (deshabilitada || soloLectura) return;
    // Enter y salida de la celda pueden llegar casi juntos: no se envían dos guardados a la vez.
    if (enVuelo.current) {
      repetir.current = true;
      return;
    }
    const enviado = textoRef.current;
    if (enviado.trim() === intentado.current.trim()) return;

    intentado.current = enviado;
    enVuelo.current = true;
    setGuardando(true);
    let exito = false;
    try {
      const nota = await guardarNota(actividad.id, estudiante.id, enviado);
      quitarErrorCelda(clave);
      const mostrado = nota ? formatoNotaRegistrada(nota.valor, escala) : '';
      intentado.current = mostrado;
      // Solo reemplaza el texto si el docente no siguió escribiendo.
      if (textoRef.current === enviado) {
        textoRef.current = mostrado;
        setTexto(mostrado);
      }
      exito = true;
    } catch (e) {
      fijarErrorCelda(clave, { ruta, etiqueta, texto: enviado, mensaje: mensajeError(e) });
    } finally {
      enVuelo.current = false;
      setGuardando(false);
      onResultado(exito);
    }
    if (repetir.current) {
      repetir.current = false;
      await guardar();
    }
  }

  const invalida = errorActual !== null;
  return (
    <input
      type="text"
      inputMode={escala.tipo === 'numerica' ? 'decimal' : 'text'}
      aria-label={`Nota de ${nombre} en ${actividad.nombre}`}
      aria-invalid={invalida || undefined}
      aria-busy={guardando || undefined}
      value={texto}
      disabled={deshabilitada}
      readOnly={soloLectura}
      onChange={(e) => {
        textoRef.current = e.target.value;
        setTexto(e.target.value);
      }}
      onBlur={() => void guardar()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void guardar();
        }
      }}
      className={`min-h-10 w-20 rounded-md border bg-white px-2 py-1 text-center text-base tabular-nums text-slate-900 read-only:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500 ${
        invalida ? 'border-red-600' : 'border-slate-300'
      }`}
    />
  );
}
