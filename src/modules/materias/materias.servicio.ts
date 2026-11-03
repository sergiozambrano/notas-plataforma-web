import type { Asignacion, BaseDatos, Curso, Materia } from '@/core/tipos';
import { ErrorNegocio, ErrorValidacion } from '@/core/errores';
import { escribirDb, leerDb } from '@/core/almacen';
import { anioPropio, asignacionPropia, cursoPropio, materiaPropia } from '@/core/acceso';
import { asegurarAnioEditable } from '@/core/bloqueos';
import { borrarAsignacion, lineaConteo } from '@/core/cascadas';
import { nuevoId } from '@/core/ids';

export interface AsignacionDetalle {
  asignacion: Asignacion;
  curso: Curso;
  materia: Materia;
}

/** Detalle de una asignación; asume que existen su curso y su materia. */
export function detalleAsignacionDe(db: BaseDatos, asignacion: Asignacion): AsignacionDetalle {
  const curso = db.cursos.find((c) => c.id === asignacion.cursoId);
  const materia = db.materias.find((m) => m.id === asignacion.materiaId);
  if (!curso || !materia) throw new ErrorNegocio('La asignación está incompleta.');
  return { asignacion, curso, materia };
}

/** Asignaciones de un año, ordenadas por curso y luego por materia. */
export function detallesDelAnio(db: BaseDatos, anioId: string): AsignacionDetalle[] {
  const cursos = db.cursos.filter((c) => c.anioLectivoId === anioId);
  const cursoIds = new Set(cursos.map((c) => c.id));
  return db.asignaciones
    .filter((a) => cursoIds.has(a.cursoId))
    .map((a) => detalleAsignacionDe(db, a))
    .sort((a, b) => a.curso.grado.localeCompare(b.curso.grado, 'es', { numeric: true })
      || a.curso.grupo.localeCompare(b.curso.grupo, 'es', { numeric: true })
      || a.materia.nombre.localeCompare(b.materia.nombre, 'es', { numeric: true }));
}

export async function listarMaterias(anioId: string): Promise<Materia[]> {
  const db = leerDb();
  anioPropio(db, anioId);
  return db.materias
    .filter((m) => m.anioLectivoId === anioId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
}

export async function crearMateria(anioId: string, datos: { nombre: string; area?: string }): Promise<Materia> {
  const nombre = datos.nombre.trim();
  if (nombre === '') throw new ErrorValidacion({ nombre: 'Escribe el nombre de la materia.' });
  const area = datos.area?.trim() ?? '';

  const salida: { materia?: Materia } = {};
  escribirDb((db) => {
    anioPropio(db, anioId);
    asegurarAnioEditable(db, anioId);
    const repetida = db.materias.some(
      (m) => m.anioLectivoId === anioId && m.nombre.trim().toLowerCase() === nombre.toLowerCase(),
    );
    if (repetida) throw new ErrorValidacion({ nombre: 'Ya existe una materia con ese nombre en este año lectivo.' });
    const materia: Materia = { id: nuevoId(), anioLectivoId: anioId, nombre };
    if (area !== '') materia.area = area;
    db.materias.push(materia);
    salida.materia = materia;
  });
  if (!salida.materia) throw new ErrorNegocio('No se pudo crear la materia.');
  return salida.materia;
}

export async function eliminarMateria(id: string): Promise<void> {
  escribirDb((db) => {
    const materia = materiaPropia(db, id);
    asegurarAnioEditable(db, materia.anioLectivoId);
    if (db.asignaciones.some((a) => a.materiaId === id)) {
      throw new ErrorNegocio('La materia está asignada a cursos. Quítala de la carga académica antes de eliminarla.');
    }
    const indice = db.materias.findIndex((m) => m.id === id);
    db.materias.splice(indice, 1);
  });
}

export async function listarAsignaciones(anioId: string): Promise<AsignacionDetalle[]> {
  const db = leerDb();
  anioPropio(db, anioId);
  return detallesDelAnio(db, anioId);
}

export async function crearAsignacion(cursoId: string, materiaId: string): Promise<Asignacion> {
  const salida: { asignacion?: Asignacion } = {};
  escribirDb((db) => {
    const curso = cursoPropio(db, cursoId);
    const materia = materiaPropia(db, materiaId);
    if (curso.anioLectivoId !== materia.anioLectivoId) {
      throw new ErrorNegocio('La materia y el curso pertenecen a años lectivos distintos.');
    }
    asegurarAnioEditable(db, curso.anioLectivoId);
    if (db.asignaciones.some((a) => a.cursoId === cursoId && a.materiaId === materiaId)) {
      throw new ErrorNegocio('Esa materia ya está asignada a este curso.');
    }
    const asignacion: Asignacion = { id: nuevoId(), cursoId, materiaId };
    db.asignaciones.push(asignacion);
    salida.asignacion = asignacion;
  });
  if (!salida.asignacion) throw new ErrorNegocio('No se pudo crear la asignación.');
  return salida.asignacion;
}

export async function resumenEliminarAsignacion(id: string): Promise<string[]> {
  const db = leerDb();
  asignacionPropia(db, id);
  const actividades = db.actividades.filter((a) => a.asignacionId === id);
  const actIds = new Set(actividades.map((a) => a.id));
  const notas = db.notas.filter((n) => actIds.has(n.actividadId)).length;

  const lineas = [lineaConteo(1, 'asignación de materia', 'asignaciones de materia')];
  if (actividades.length > 0) lineas.push(lineaConteo(actividades.length, 'actividad', 'actividades'));
  if (notas > 0) lineas.push(lineaConteo(notas, 'nota', 'notas'));
  return lineas;
}

export async function eliminarAsignacion(id: string): Promise<void> {
  escribirDb((db) => {
    const asignacion = asignacionPropia(db, id);
    const curso = cursoPropio(db, asignacion.cursoId);
    asegurarAnioEditable(db, curso.anioLectivoId);
    borrarAsignacion(db, id);
  });
}
