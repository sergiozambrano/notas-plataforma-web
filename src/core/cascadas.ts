import type { BaseDatos } from './tipos';

/** Quita en sitio los elementos que cumplen `pred`. */
function quitarDonde<T>(lista: T[], pred: (x: T) => boolean): void {
  for (let i = lista.length - 1; i >= 0; i--) {
    if (pred(lista[i])) lista.splice(i, 1);
  }
}

/** "1 estudiante", "3 estudiantes"… */
export function lineaConteo(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function borrarActividad(db: BaseDatos, actividadId: string): void {
  quitarDonde(db.notas, (n) => n.actividadId === actividadId);
  quitarDonde(db.actividades, (a) => a.id === actividadId);
}

export function borrarAsignacion(db: BaseDatos, asignacionId: string): void {
  for (const act of db.actividades.filter((a) => a.asignacionId === asignacionId)) {
    borrarActividad(db, act.id);
  }
  quitarDonde(db.cierres, (c) => c.asignacionId === asignacionId);
  quitarDonde(db.asignaciones, (a) => a.id === asignacionId);
}

export function borrarEstudiante(db: BaseDatos, estudianteId: string): void {
  quitarDonde(db.notas, (n) => n.estudianteId === estudianteId);
  for (const cierre of db.cierres) delete cierre.notasCalculadas[estudianteId];
  quitarDonde(db.estudiantes, (e) => e.id === estudianteId);
}

export function borrarCurso(db: BaseDatos, cursoId: string): void {
  for (const asig of db.asignaciones.filter((a) => a.cursoId === cursoId)) {
    borrarAsignacion(db, asig.id);
  }
  for (const est of db.estudiantes.filter((e) => e.cursoId === cursoId)) {
    borrarEstudiante(db, est.id);
  }
  quitarDonde(db.cursos, (c) => c.id === cursoId);
}

export function borrarPeriodo(db: BaseDatos, periodoId: string): void {
  for (const act of db.actividades.filter((a) => a.periodoId === periodoId)) {
    borrarActividad(db, act.id);
  }
  quitarDonde(db.cierres, (c) => c.periodoId === periodoId);
  quitarDonde(db.periodos, (p) => p.id === periodoId);
}

export function borrarAnio(db: BaseDatos, anioId: string): void {
  for (const p of db.periodos.filter((x) => x.anioLectivoId === anioId)) {
    borrarPeriodo(db, p.id);
  }
  for (const c of db.cursos.filter((x) => x.anioLectivoId === anioId)) {
    borrarCurso(db, c.id);
  }
  quitarDonde(db.eventos, (e) => e.anioLectivoId === anioId);
  quitarDonde(db.materias, (m) => m.anioLectivoId === anioId);
  quitarDonde(db.anios, (a) => a.id === anioId);
}

export function borrarPerfil(db: BaseDatos, perfilId: string): void {
  for (const a of db.anios.filter((x) => x.perfilId === perfilId)) {
    borrarAnio(db, a.id);
  }
  quitarDonde(db.perfiles, (p) => p.id === perfilId);
}
