import type { Estudiante } from '@/core/tipos';
import { ErrorAdvertencia, ErrorNegocio, ErrorValidacion } from '@/core/errores';
import { escribirDb, leerDb } from '@/core/almacen';
import { cursoPropio, estudiantePropio } from '@/core/acceso';
import { asegurarAnioEditable } from '@/core/bloqueos';
import { borrarEstudiante, lineaConteo } from '@/core/cascadas';
import { nuevoId } from '@/core/ids';

export async function listarEstudiantes(cursoId: string): Promise<Estudiante[]> {
  const db = leerDb();
  cursoPropio(db, cursoId);
  return db.estudiantes
    .filter((e) => e.cursoId === cursoId)
    .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es') || a.nombres.localeCompare(b.nombres, 'es'));
}

export async function crearEstudiante(
  cursoId: string,
  datos: { nombres: string; apellidos: string; codigo?: string },
  opciones: { confirmado?: boolean } = {},
): Promise<Estudiante> {
  const nombres = datos.nombres.trim();
  const apellidos = datos.apellidos.trim();
  const errores: Record<string, string> = {};
  if (nombres === '') errores.nombres = 'Escribe los nombres.';
  if (apellidos === '') errores.apellidos = 'Escribe los apellidos.';
  if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);
  const codigo = datos.codigo?.trim() ?? '';

  const salida: { estudiante?: Estudiante } = {};
  escribirDb((db) => {
    const curso = cursoPropio(db, cursoId);
    asegurarAnioEditable(db, curso.anioLectivoId);
    const duplicado = db.estudiantes.some(
      (e) => e.cursoId === cursoId
        && e.nombres.trim().toLowerCase() === nombres.toLowerCase()
        && e.apellidos.trim().toLowerCase() === apellidos.toLowerCase(),
    );
    if (duplicado && !opciones.confirmado) {
      throw new ErrorAdvertencia(
        `Ya hay un estudiante con los nombres "${nombres}" y apellidos "${apellidos}" en este curso. ¿Quieres registrarlo igual?`,
      );
    }
    const estudiante: Estudiante = { id: nuevoId(), cursoId, nombres, apellidos };
    if (codigo !== '') estudiante.codigo = codigo;
    db.estudiantes.push(estudiante);
    salida.estudiante = estudiante;
  });
  if (!salida.estudiante) throw new ErrorNegocio('No se pudo registrar el estudiante.');
  return salida.estudiante;
}

export async function resumenEliminarEstudiante(id: string): Promise<string[]> {
  const db = leerDb();
  estudiantePropio(db, id);
  const notas = db.notas.filter((n) => n.estudianteId === id).length;
  const lineas = [lineaConteo(1, 'estudiante', 'estudiantes')];
  if (notas > 0) lineas.push(lineaConteo(notas, 'nota', 'notas'));
  return lineas;
}

export async function eliminarEstudiante(id: string): Promise<void> {
  escribirDb((db) => {
    const estudiante = estudiantePropio(db, id);
    const curso = cursoPropio(db, estudiante.cursoId);
    asegurarAnioEditable(db, curso.anioLectivoId);
    borrarEstudiante(db, id);
  });
}
