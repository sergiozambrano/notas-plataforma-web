import type { Curso } from '@/core/tipos';
import { ErrorNegocio, ErrorValidacion } from '@/core/errores';
import { escribirDb, leerDb } from '@/core/almacen';
import { anioPropio, cursoPropio } from '@/core/acceso';
import { asegurarAnioEditable } from '@/core/bloqueos';
import { borrarCurso, lineaConteo } from '@/core/cascadas';
import { nuevoId } from '@/core/ids';

export async function listarCursos(anioId: string): Promise<Curso[]> {
  const db = leerDb();
  anioPropio(db, anioId);
  return db.cursos
    .filter((c) => c.anioLectivoId === anioId)
    .sort((a, b) => a.grado.localeCompare(b.grado, 'es', { numeric: true })
      || a.grupo.localeCompare(b.grupo, 'es', { numeric: true }));
}

export async function obtenerCurso(id: string): Promise<Curso> {
  return cursoPropio(leerDb(), id);
}

export async function crearCurso(anioId: string, datos: { grado: string; grupo: string }): Promise<Curso> {
  const grado = datos.grado.trim();
  const grupo = datos.grupo.trim();
  const errores: Record<string, string> = {};
  if (grado === '') errores.grado = 'Escribe el grado, por ejemplo "Quinto".';
  if (grupo === '') errores.grupo = 'Escribe el grupo, por ejemplo "A".';
  if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);

  const salida: { curso?: Curso } = {};
  escribirDb((db) => {
    anioPropio(db, anioId);
    asegurarAnioEditable(db, anioId);
    const repetido = db.cursos.some(
      (c) => c.anioLectivoId === anioId
        && c.grado.trim().toLowerCase() === grado.toLowerCase()
        && c.grupo.trim().toLowerCase() === grupo.toLowerCase(),
    );
    if (repetido) {
      throw new ErrorValidacion({ grupo: 'Ya existe un curso con este grado y grupo en este año lectivo.' });
    }
    const curso: Curso = { id: nuevoId(), anioLectivoId: anioId, grado, grupo };
    db.cursos.push(curso);
    salida.curso = curso;
  });
  if (!salida.curso) throw new ErrorNegocio('No se pudo crear el curso.');
  return salida.curso;
}

export async function resumenEliminarCurso(id: string): Promise<string[]> {
  const db = leerDb();
  cursoPropio(db, id);
  const estudiantes = db.estudiantes.filter((e) => e.cursoId === id).length;
  const asignaciones = db.asignaciones.filter((a) => a.cursoId === id);
  const asigIds = new Set(asignaciones.map((a) => a.id));
  const actIds = new Set(db.actividades.filter((a) => asigIds.has(a.asignacionId)).map((a) => a.id));
  const notas = db.notas.filter((n) => actIds.has(n.actividadId)).length;

  const lineas = [lineaConteo(1, 'curso', 'cursos')];
  if (estudiantes > 0) lineas.push(lineaConteo(estudiantes, 'estudiante', 'estudiantes'));
  if (asignaciones.length > 0) lineas.push(lineaConteo(asignaciones.length, 'materia asignada', 'materias asignadas'));
  if (notas > 0) lineas.push(lineaConteo(notas, 'nota', 'notas'));
  return lineas;
}

export async function eliminarCurso(id: string): Promise<void> {
  escribirDb((db) => {
    const curso = cursoPropio(db, id);
    asegurarAnioEditable(db, curso.anioLectivoId);
    borrarCurso(db, id);
  });
}
