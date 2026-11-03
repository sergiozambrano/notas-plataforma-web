// Validaciones de fechas y porcentajes: funciones puras.
import type { AnioLectivo, EventoCalendario, Periodo, PorcentajesGrupos } from '@/core/tipos';
import { esFechaISO } from '@/core/reloj';
import { aNumero, CERO, compara, Fraccion, fraccion, suma } from '@/modules/evaluacion/fraccion';
import { formatoNumero } from '@/modules/evaluacion/notas';

export function rangoValido(ini: string, fin: string): boolean {
  return esFechaISO(ini) && esFechaISO(fin) && fin >= ini;
}

/** Errores por campo de un rango de fechas, o null si es válido. */
export function validarRangoFechas(ini: string, fin: string): Record<string, string> | null {
  const errores: Record<string, string> = {};
  if (!esFechaISO(ini)) errores.fechaInicio = 'Escribe una fecha de inicio válida.';
  if (!esFechaISO(fin)) errores.fechaFin = 'Escribe una fecha de fin válida.';
  if (!errores.fechaInicio && !errores.fechaFin && fin < ini) {
    errores.fechaFin = 'La fecha de fin no puede ser anterior a la de inicio.';
  }
  return Object.keys(errores).length > 0 ? errores : null;
}

/** Devuelve los elementos de `otros` que se cruzan con `rango` (extremos inclusivos). Ignora el mismo id. */
export function cruces<T extends { id?: string; fechaInicio: string; fechaFin: string }>(
  rango: { id?: string; fechaInicio: string; fechaFin: string },
  otros: T[],
): T[] {
  return otros.filter(
    (o) =>
      !(rango.id !== undefined && o.id === rango.id) &&
      o.fechaInicio <= rango.fechaFin &&
      rango.fechaInicio <= o.fechaFin,
  );
}

function comparaFechas(a: Periodo, b: Periodo): number {
  if (a.fechaInicio !== b.fechaInicio) return a.fechaInicio < b.fechaInicio ? -1 : 1;
  if (a.fechaFin !== b.fechaFin) return a.fechaFin < b.fechaFin ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function ordenarPeriodos(periodos: Periodo[]): Periodo[] {
  return [...periodos].sort(comparaFechas);
}

export function numeroPeriodo(id: string, periodos: Periodo[]): number {
  const indice = ordenarPeriodos(periodos).findIndex((p) => p.id === id);
  if (indice < 0) throw new RangeError(`Periodo no encontrado: ${id}`);
  return indice + 1;
}

export function sumaPorcentajes(valores: number[]): Fraccion {
  return valores.reduce((acc, v) => suma(acc, fraccion(v)), CERO);
}

export function sumaEs100(valores: number[]): boolean {
  return compara(sumaPorcentajes(valores), fraccion(100)) === 0;
}

function textoSuma(valores: number[]): string {
  return formatoNumero(aNumero(sumaPorcentajes(valores)), 2);
}

export function validarGrupos(p: PorcentajesGrupos): string | null {
  const valores = [p.ser, p.saber, p.hacer];
  if (valores.some((v) => !(v > 0))) return 'Ser, Saber y Hacer deben ser mayores que 0 %.';
  if (!sumaEs100(valores)) {
    return `Ser, Saber y Hacer suman ${textoSuma(valores)} %; deben sumar 100 %.`;
  }
  return null;
}

export function validarPesos(pesos: (number | undefined)[]): string | null {
  if (pesos.some((p) => p === undefined)) return 'Falta el peso de algún periodo.';
  const valores = pesos as number[];
  if (valores.some((v) => !(v > 0))) return 'Cada peso debe ser mayor que 0 %.';
  if (!sumaEs100(valores)) return `Los pesos suman ${textoSuma(valores)} %; deben sumar 100 %.`;
  return null;
}

/** Regla 7: textos para Panel y Planilla, nombrando "Periodo N". */
export function problemasConfiguracion(anio: AnioLectivo, periodos: Periodo[], periodoId?: string): string[] {
  const problemas: string[] = [];
  if (periodos.length === 0) problemas.push('El año no tiene periodos. Agrega al menos uno.');
  const ordenados = ordenarPeriodos(periodos);
  const numero = (p: Periodo): number => ordenados.indexOf(p) + 1;

  if (anio.modoPesoPeriodos === 'varian' && ordenados.length > 0) {
    const sinPeso = ordenados.filter((p) => p.peso === undefined);
    if (sinPeso.length > 0) {
      for (const p of sinPeso) problemas.push(`Periodo ${numero(p)}: falta su peso.`);
    } else {
      const mensaje = validarPesos(ordenados.map((p) => p.peso));
      if (mensaje) problemas.push(mensaje);
    }
  }

  if (anio.modoGrupos === 'iguales') {
    const g = anio.gruposIguales;
    if (g.ser === 0 && g.saber === 0 && g.hacer === 0) {
      problemas.push('Falta configurar los porcentajes de Ser, Saber y Hacer para todos los periodos.');
    } else {
      const mensaje = validarGrupos(g);
      if (mensaje) problemas.push(mensaje);
    }
  }

  const objetivos = periodoId === undefined ? ordenados : ordenados.filter((p) => p.id === periodoId);
  for (const p of objetivos) {
    const n = numero(p);
    if (!rangoValido(p.fechaInicio, p.fechaFin)) {
      problemas.push(`Periodo ${n}: las fechas no son válidas (la de fin debe ser igual o posterior a la de inicio).`);
    }
    if (anio.modoGrupos === 'varian') {
      if (!p.grupos) {
        problemas.push(`Periodo ${n}: faltan los porcentajes de Ser, Saber y Hacer.`);
      } else {
        const mensaje = validarGrupos(p.grupos);
        if (mensaje) problemas.push(`Periodo ${n}: ${mensaje}`);
      }
    }
  }
  return problemas;
}

export function actividadEnVacaciones(fecha: string, vacaciones: EventoCalendario[]): EventoCalendario | null {
  return vacaciones.find((v) => v.fechaInicio <= fecha && fecha <= v.fechaFin) ?? null;
}
