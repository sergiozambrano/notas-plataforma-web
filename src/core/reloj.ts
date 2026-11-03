import { format } from 'date-fns';
import type { FechaISO } from './tipos';

let fijo: Date | null = null;

/** Solo para pruebas: fija el "ahora" del sistema. `null` vuelve al reloj real. */
export function fijarReloj(fecha: Date | null): void {
  fijo = fecha === null ? null : new Date(fecha.getTime());
}

function ahora(): Date {
  return fijo === null ? new Date() : new Date(fijo.getTime());
}

export function hoy(): FechaISO {
  return format(ahora(), 'yyyy-MM-dd');
}

export function anioActual(): number {
  return ahora().getFullYear();
}

export function ahoraISO(): string {
  return ahora().toISOString();
}

/** Valida formato yyyy-MM-dd y que la fecha exista (sin usar Date). */
export function esFechaISO(texto: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  const diasMes = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia <= diasMes[mes - 1];
}
