import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ErrorValidacion } from '@/core/errores';

/** Texto listo para mostrar en un <Aviso> para cualquier error de servicio. */
export function mensajeError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}

/**
 * Pasa los errores por campo (ErrorValidacion) a react-hook-form.
 * Devuelve true si el error era de validación por campo. Si devuelve false,
 * muestra `mensajeError(e)` en un <Aviso>.
 */
export function aplicarErroresCampos<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>): boolean {
  if (!(e instanceof ErrorValidacion)) return false;
  for (const [campo, mensaje] of Object.entries(e.campos)) {
    setError(campo as Path<T>, { type: 'server', message: mensaje });
  }
  return true;
}
