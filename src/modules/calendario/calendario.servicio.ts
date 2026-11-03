import type { EventoCalendario } from '@/core/tipos';
import { ErrorAdvertencia, ErrorNegocio, ErrorValidacion } from '@/core/errores';
import { escribirDb, leerDb } from '@/core/almacen';
import { anioPropio, eventoPropio } from '@/core/acceso';
import { asegurarAnioEditable } from '@/core/bloqueos';
import { nuevoId } from '@/core/ids';
import {
  actividadEnVacaciones, cruces, validarRangoFechas,
} from '@/modules/periodos/validaciones';
import { esFechaISO } from '@/core/reloj';

export interface DatosEvento {
  tipo: 'vacaciones' | 'actividad';
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
}

export async function listarEventos(anioId: string): Promise<EventoCalendario[]> {
  const db = leerDb();
  anioPropio(db, anioId);
  return db.eventos
    .filter((e) => e.anioLectivoId === anioId)
    .sort((a, b) => (a.fechaInicio === b.fechaInicio
      ? a.fechaFin.localeCompare(b.fechaFin)
      : a.fechaInicio.localeCompare(b.fechaInicio)));
}

/** Actividad con fecha única: fechaFin = fechaInicio. */
export async function crearEvento(
  anioId: string,
  datos: DatosEvento,
  opciones: { confirmado?: boolean } = {},
): Promise<EventoCalendario> {
  const nombre = datos.nombre.trim();
  if (nombre === '') throw new ErrorValidacion({ nombre: 'Escribe un nombre.' });
  const fechaFin = datos.tipo === 'actividad' ? datos.fechaInicio : datos.fechaFin;
  if (datos.tipo === 'actividad' && !esFechaISO(datos.fechaInicio)) {
    throw new ErrorValidacion({ fechaInicio: 'Escribe una fecha válida.' });
  }
  const errores = validarRangoFechas(datos.fechaInicio, fechaFin);
  if (errores) throw new ErrorValidacion(errores);

  const salida: { evento?: EventoCalendario } = {};
  escribirDb((db) => {
    anioPropio(db, anioId);
    asegurarAnioEditable(db, anioId);
    const vacaciones = db.eventos.filter((e) => e.anioLectivoId === anioId && e.tipo === 'vacaciones');

    if (datos.tipo === 'vacaciones') {
      const cruzadas = cruces({ fechaInicio: datos.fechaInicio, fechaFin }, vacaciones);
      if (cruzadas.length > 0) {
        const nombres = cruzadas.map((v) => `"${v.nombre}"`).join(' y ');
        throw new ErrorNegocio(`Las vacaciones se cruzan con ${nombres}.`);
      }
    } else {
      const enVacaciones = actividadEnVacaciones(datos.fechaInicio, vacaciones);
      if (enVacaciones && !opciones.confirmado) {
        throw new ErrorAdvertencia(
          `La actividad cae en las vacaciones "${enVacaciones.nombre}". ¿Quieres registrarla de todos modos?`,
        );
      }
    }

    const evento: EventoCalendario = {
      id: nuevoId(),
      anioLectivoId: anioId,
      tipo: datos.tipo,
      nombre,
      fechaInicio: datos.fechaInicio,
      fechaFin,
    };
    db.eventos.push(evento);
    salida.evento = evento;
  });
  if (!salida.evento) throw new ErrorNegocio('No se pudo crear el evento.');
  return salida.evento;
}

export async function eliminarEvento(id: string): Promise<void> {
  escribirDb((db) => {
    const evento = eventoPropio(db, id);
    asegurarAnioEditable(db, evento.anioLectivoId);
    const indice = db.eventos.findIndex((e) => e.id === id);
    db.eventos.splice(indice, 1);
  });
}
