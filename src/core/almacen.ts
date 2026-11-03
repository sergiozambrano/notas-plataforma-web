import type { BaseDatos } from './tipos';

const CLAVE = 'gestion-notas:db:v1';
const PREFIJO = 'gestion-notas:';

/** Base de datos vacía (sin registros). */
export function dbVacia(): BaseDatos {
  return {
    usuarios: [], tokens: [], correos: [], intentosCorreoDesconocido: {},
    perfiles: [], anios: [], periodos: [], eventos: [], cursos: [], materias: [],
    asignaciones: [], estudiantes: [], actividades: [], notas: [], cierres: [],
  };
}

export function existeDb(): boolean {
  return localStorage.getItem(CLAVE) !== null;
}

export function leerDb(): BaseDatos {
  const crudo = localStorage.getItem(CLAVE);
  return crudo === null ? dbVacia() : (JSON.parse(crudo) as BaseDatos);
}

/**
 * Ejecuta `mutar` sobre una copia leída del almacenamiento y la guarda solo si
 * `mutar` termina sin lanzar. Si lanza, no se escribe nada.
 */
export function escribirDb(mutar: (db: BaseDatos) => void): void {
  const db = leerDb();
  mutar(db);
  localStorage.setItem(CLAVE, JSON.stringify(db));
}

export function borrarTodo(): void {
  const claves: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const clave = localStorage.key(i);
    if (clave !== null && clave.startsWith(PREFIJO)) claves.push(clave);
  }
  for (const clave of claves) localStorage.removeItem(clave);
}
