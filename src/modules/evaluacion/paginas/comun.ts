import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Estudiante, Periodo } from '@/core/tipos';
import type { AsignacionDetalle } from '@/modules/materias/materias.servicio';
import { fechaLarga } from '@/ui';

/** "Quinto A · Matemáticas" */
export function etiquetaAsignacion(detalle: AsignacionDetalle): string {
  return `${detalle.curso.grado} ${detalle.curso.grupo} · ${detalle.materia.nombre}`;
}

/** Mismo orden que usa el servicio para ordenar estudiantes: "Apellidos Nombres". */
export function nombreEstudiante(estudiante: Pick<Estudiante, 'apellidos' | 'nombres'>): string {
  return `${estudiante.apellidos} ${estudiante.nombres}`;
}

export function etiquetaPeriodo(numero: number): string {
  return `Periodo ${numero}`;
}

export function rangoPeriodo(periodo: Periodo): string {
  return `Del ${fechaLarga(periodo.fechaInicio)} al ${fechaLarga(periodo.fechaFin)}`;
}

export function fechaCorta(fechaISO: string): string {
  return format(parseISO(fechaISO), 'd MMM yyyy', { locale: es });
}

/** Porcentaje con coma decimal y sin ceros sobrantes: 30 → "30 %", 33,333 → "33,33 %". */
export function porcentajeTexto(valor: number): string {
  return `${Number(valor.toFixed(2)).toString().replace('.', ',')} %`;
}
