import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/** Fecha 'yyyy-MM-dd' en formato largo en español: "3 de agosto de 2026". */
export function fechaLarga(fechaISO: string): string {
  return format(parseISO(fechaISO), "d 'de' MMMM 'de' yyyy", { locale: es });
}
