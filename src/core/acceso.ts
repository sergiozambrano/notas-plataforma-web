import type {
  Actividad, Asignacion, AnioLectivo, BaseDatos, Curso, EventoCalendario,
  Estudiante, Materia, Perfil, Periodo,
} from './tipos';
import { ErrorAcceso } from './errores';
import { exigirUsuarioId } from './sesion';

/**
 * Aislamiento (regla 11): cada función sube por la cadena de pertenencia hasta
 * el perfil y exige que su usuarioId sea el de la sesión. Si no coincide o el
 * recurso no existe, lanza ErrorAcceso. Sin sesión lanza ErrorSesion.
 */

function buscar<T extends { id: string }>(lista: T[], id: string): T {
  const encontrado = lista.find((x) => x.id === id);
  if (!encontrado) throw new ErrorAcceso();
  return encontrado;
}

export function perfilPropio(db: BaseDatos, id: string): Perfil {
  const perfil = buscar(db.perfiles, id);
  if (perfil.usuarioId !== exigirUsuarioId()) throw new ErrorAcceso();
  return perfil;
}

export function anioPropio(db: BaseDatos, id: string): AnioLectivo {
  const anio = buscar(db.anios, id);
  perfilPropio(db, anio.perfilId);
  return anio;
}

export function periodoPropio(db: BaseDatos, id: string): Periodo {
  const periodo = buscar(db.periodos, id);
  anioPropio(db, periodo.anioLectivoId);
  return periodo;
}

export function eventoPropio(db: BaseDatos, id: string): EventoCalendario {
  const evento = buscar(db.eventos, id);
  anioPropio(db, evento.anioLectivoId);
  return evento;
}

export function cursoPropio(db: BaseDatos, id: string): Curso {
  const curso = buscar(db.cursos, id);
  anioPropio(db, curso.anioLectivoId);
  return curso;
}

export function materiaPropia(db: BaseDatos, id: string): Materia {
  const materia = buscar(db.materias, id);
  anioPropio(db, materia.anioLectivoId);
  return materia;
}

export function asignacionPropia(db: BaseDatos, id: string): Asignacion {
  const asignacion = buscar(db.asignaciones, id);
  cursoPropio(db, asignacion.cursoId);
  return asignacion;
}

export function estudiantePropio(db: BaseDatos, id: string): Estudiante {
  const estudiante = buscar(db.estudiantes, id);
  cursoPropio(db, estudiante.cursoId);
  return estudiante;
}

export function actividadPropia(db: BaseDatos, id: string): Actividad {
  const actividad = buscar(db.actividades, id);
  asignacionPropia(db, actividad.asignacionId);
  return actividad;
}
