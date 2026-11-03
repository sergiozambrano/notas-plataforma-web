/**
 * Celdas de la planilla con un error de guardado que aún no se corrige.
 * Vive en memoria del módulo: sobrevive a la navegación dentro de la app
 * (la celda vuelve a mostrar el texto y el error), pero no a una recarga completa.
 */
export interface ErrorNota {
  ruta: string;
  etiqueta: string;
  texto: string;
  mensaje: string;
}

const SEP = '|';
const errores = new Map<string, ErrorNota>();

export function clavePlanilla(asignacionId: string, periodoId: string): string {
  return `${asignacionId}${SEP}${periodoId}`;
}

export function claveCelda(asignacionId: string, periodoId: string, actividadId: string, estudianteId: string): string {
  return [asignacionId, periodoId, actividadId, estudianteId].join(SEP);
}

export function errorDeCelda(clave: string): ErrorNota | undefined {
  return errores.get(clave);
}

export function fijarErrorCelda(clave: string, error: ErrorNota): void {
  errores.set(clave, error);
}

export function quitarErrorCelda(clave: string): void {
  errores.delete(clave);
}

export function erroresDePlanilla(asignacionId: string, periodoId: string): { clave: string; error: ErrorNota }[] {
  const prefijo = `${clavePlanilla(asignacionId, periodoId)}${SEP}`;
  return [...errores.entries()]
    .filter(([clave]) => clave.startsWith(prefijo))
    .map(([clave, error]) => ({ clave, error }));
}

/** Todos los errores pendientes, de cualquier planilla. */
export function erroresPendientes(): ErrorNota[] {
  return [...errores.values()];
}

/** Descarta errores de actividades o estudiantes que ya no existen en la planilla. */
export function podarErroresDePlanilla(
  asignacionId: string,
  periodoId: string,
  actividadIds: string[],
  estudianteIds: string[],
): void {
  const actividades = new Set(actividadIds);
  const estudiantes = new Set(estudianteIds);
  for (const { clave } of erroresDePlanilla(asignacionId, periodoId)) {
    const [, , actividadId, estudianteId] = clave.split(SEP);
    if (!actividades.has(actividadId) || !estudiantes.has(estudianteId)) errores.delete(clave);
  }
}
