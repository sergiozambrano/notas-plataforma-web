import type { AnioLectivo, BaseDatos, Perfil } from './tipos';
import { ErrorNegocio } from './errores';
import { anioActual } from './reloj';

/** Regla 9d: años anteriores al actual y perfiles inactivos son solo consulta. Pura. */
export function motivoSoloLectura(perfil: Pick<Perfil, 'activo'>, anio: Pick<AnioLectivo, 'anio'>): string | null {
  if (!perfil.activo) return 'Perfil inactivo: solo consulta';
  if (anio.anio < anioActual()) return 'Año anterior: solo consulta';
  return null;
}

function anioDe(db: BaseDatos, anioId: string): AnioLectivo {
  const anio = db.anios.find((a) => a.id === anioId);
  if (!anio) throw new ErrorNegocio('El año lectivo no existe.');
  return anio;
}

function periodosDelAnio(db: BaseDatos, anioId: string) {
  return db.periodos.filter((p) => p.anioLectivoId === anioId);
}

/** 9d: llamar en toda escritura de datos del año. */
export function asegurarAnioEditable(db: BaseDatos, anioId: string): void {
  const anio = anioDe(db, anioId);
  const perfil = db.perfiles.find((p) => p.id === anio.perfilId);
  if (!perfil) throw new ErrorNegocio('El perfil del año no existe.');
  const motivo = motivoSoloLectura(perfil, anio);
  if (motivo) throw new ErrorNegocio(motivo);
}

/** 9b: con algún periodo finalizado no se agregan ni quitan periodos ni se cambian pesos o porcentajes. */
export function asegurarEstructuraPeriodos(db: BaseDatos, anioId: string): void {
  const ids = new Set(periodosDelAnio(db, anioId).map((p) => p.id));
  if (db.cierres.some((c) => ids.has(c.periodoId))) {
    throw new ErrorNegocio(
      'Hay periodos finalizados en este año: no se pueden agregar ni quitar periodos, ni cambiar pesos o porcentajes.',
    );
  }
}

/** 9b: un periodo finalizado en cualquier asignación no se elimina ni cambia de fechas. */
export function asegurarPeriodoSinCierre(db: BaseDatos, periodoId: string): void {
  if (db.cierres.some((c) => c.periodoId === periodoId)) {
    throw new ErrorNegocio('Este periodo ya está finalizado en alguna asignación: no se puede eliminar ni cambiar sus fechas.');
  }
}

/** 9a: con el periodo finalizado para la asignación, no se editan sus notas ni actividades. */
export function asegurarAsignacionAbierta(db: BaseDatos, asignacionId: string, periodoId: string): void {
  if (db.cierres.some((c) => c.asignacionId === asignacionId && c.periodoId === periodoId)) {
    throw new ErrorNegocio('Este periodo ya está finalizado para esta materia: sus notas y actividades son de solo lectura.');
  }
}

/** 9c: considera todos los años del perfil. */
export function perfilConCierres(db: BaseDatos, perfilId: string): boolean {
  const anioIds = new Set(db.anios.filter((a) => a.perfilId === perfilId).map((a) => a.id));
  const periodoIds = new Set(db.periodos.filter((p) => anioIds.has(p.anioLectivoId)).map((p) => p.id));
  return db.cierres.some((c) => periodoIds.has(c.periodoId));
}

/** 9c: con cierres en el perfil no se cambian escala, decimales, nota para aprobar ni niveles. */
export function asegurarReglasPerfil(db: BaseDatos, perfilId: string): void {
  if (perfilConCierres(db, perfilId)) {
    throw new ErrorNegocio(
      'Hay periodos finalizados en este perfil: no se pueden cambiar la escala, los decimales, la nota para aprobar ni los niveles nacionales.',
    );
  }
}

export function asegurarPerfilActivo(db: BaseDatos, perfilId: string): void {
  const perfil = db.perfiles.find((p) => p.id === perfilId);
  if (!perfil) throw new ErrorNegocio('El perfil no existe.');
  if (!perfil.activo) throw new ErrorNegocio('Perfil inactivo: solo consulta');
}
