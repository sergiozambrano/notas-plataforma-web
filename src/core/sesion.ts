import { ErrorSesion } from './errores';

const CLAVE = 'gestion-notas:sesion';

export function iniciarSesionLocal(usuarioId: string): void {
  localStorage.setItem(CLAVE, usuarioId);
}

export function cerrarSesionLocal(): void {
  localStorage.removeItem(CLAVE);
}

export function usuarioIdSesion(): string | null {
  return localStorage.getItem(CLAVE);
}

export function exigirUsuarioId(): string {
  const id = usuarioIdSesion();
  if (id === null) throw new ErrorSesion();
  return id;
}
