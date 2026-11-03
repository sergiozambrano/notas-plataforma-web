import { describe, expect, it } from 'vitest';
import type { AnioLectivo, Periodo } from '@/core/tipos';
import {
  actividadEnVacaciones, cruces, numeroPeriodo, ordenarPeriodos, problemasConfiguracion,
  rangoValido, sumaEs100, sumaPorcentajes, validarGrupos, validarPesos, validarRangoFechas,
} from './validaciones';
import { aNumero } from '@/modules/evaluacion/fraccion';

const periodo = (id: string, fechaInicio: string, fechaFin: string, extra: Partial<Periodo> = {}): Periodo => ({
  id, anioLectivoId: 'a', fechaInicio, fechaFin, ...extra,
});

const anioBase: AnioLectivo = {
  id: 'a', perfilId: 'p', anio: 2026, modoPesoPeriodos: 'iguales', modoGrupos: 'iguales',
  gruposIguales: { ser: 20, saber: 50, hacer: 30 },
};

describe('rangoValido', () => {
  it('acepta fechas en orden y el mismo día', () => {
    expect(rangoValido('2026-02-01', '2026-03-01')).toBe(true);
    expect(rangoValido('2026-02-01', '2026-02-01')).toBe(true);
  });

  it('rechaza fin anterior al inicio', () => {
    expect(rangoValido('2026-03-01', '2026-02-01')).toBe(false);
  });

  it('rechaza fechas que no existen o con formato distinto', () => {
    expect(rangoValido('2026-02-30', '2026-03-01')).toBe(false);
    expect(rangoValido('01/02/2026', '2026-03-01')).toBe(false);
  });
});

describe('validarRangoFechas', () => {
  it('señala fin anterior al inicio en fechaFin', () => {
    expect(validarRangoFechas('2026-03-01', '2026-02-01')).toEqual({
      fechaFin: 'La fecha de fin no puede ser anterior a la de inicio.',
    });
  });

  it('es null para un rango válido', () => {
    expect(validarRangoFechas('2026-02-01', '2026-02-10')).toBeNull();
  });
});

describe('cruces', () => {
  const existentes = [
    periodo('p1', '2026-02-01', '2026-03-31'),
    periodo('p2', '2026-04-10', '2026-06-30'),
  ];

  it('detecta solape parcial', () => {
    const cruzados = cruces({ fechaInicio: '2026-03-15', fechaFin: '2026-04-15' }, existentes);
    expect(cruzados.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('cuenta como cruce cuando un extremo toca el otro (inclusivo)', () => {
    // p1 termina el 31-mar: un rango que empieza el 31-mar se cruza.
    const toca = cruces({ fechaInicio: '2026-03-31', fechaFin: '2026-04-05' }, existentes);
    expect(toca.map((p) => p.id)).toEqual(['p1']);
  });

  it('no hay cruce si el rango queda justo después', () => {
    expect(cruces({ fechaInicio: '2026-04-01', fechaFin: '2026-04-09' }, existentes)).toEqual([]);
  });

  it('ignora el mismo id (al editar un periodo no se cruza consigo mismo)', () => {
    expect(cruces({ id: 'p1', fechaInicio: '2026-02-01', fechaFin: '2026-03-31' }, existentes)).toEqual([]);
  });
});

describe('numeración de periodos', () => {
  const desordenados = [
    periodo('mayo', '2026-05-01', '2026-06-30'),
    periodo('febrero', '2026-02-01', '2026-03-31'),
    periodo('abril', '2026-04-01', '2026-04-30'),
  ];

  it('numera por orden de fechas, no por orden de registro', () => {
    expect(numeroPeriodo('febrero', desordenados)).toBe(1);
    expect(numeroPeriodo('abril', desordenados)).toBe(2);
    expect(numeroPeriodo('mayo', desordenados)).toBe(3);
  });

  it('ordenarPeriodos devuelve el orden cronológico', () => {
    expect(ordenarPeriodos(desordenados).map((p) => p.id)).toEqual(['febrero', 'abril', 'mayo']);
  });
});

describe('sumas de porcentajes exactas', () => {
  it('33,3 + 33,3 + 33,4 suma 100 exacto', () => {
    expect(sumaEs100([33.3, 33.3, 33.4])).toBe(true);
    expect(aNumero(sumaPorcentajes([33.3, 33.3, 33.4]))).toBe(100);
  });

  it('0,1 + 0,2 + 99,7 suma 100 exacto (sin error de punto flotante)', () => {
    expect(sumaEs100([0.1, 0.2, 99.7])).toBe(true);
  });

  it('33,3 × 3 no suma 100', () => {
    expect(sumaEs100([33.3, 33.3, 33.3])).toBe(false);
  });
});

describe('validarGrupos', () => {
  it('acepta 20/50/30', () => {
    expect(validarGrupos({ ser: 20, saber: 50, hacer: 30 })).toBeNull();
  });

  it('rechaza un grupo en 0 o negativo', () => {
    expect(validarGrupos({ ser: 0, saber: 50, hacer: 50 })).toContain('mayores que 0');
    expect(validarGrupos({ ser: -5, saber: 55, hacer: 50 })).toContain('mayores que 0');
  });

  it('rechaza una suma distinta de 100 e indica la suma actual', () => {
    expect(validarGrupos({ ser: 20, saber: 50, hacer: 20 })).toBe(
      'Ser, Saber y Hacer suman 90,00 %; deben sumar 100 %.',
    );
  });
});

describe('validarPesos', () => {
  it('acepta pesos que suman 100', () => {
    expect(validarPesos([30, 30, 40])).toBeNull();
  });

  it('muestra la suma actual cuando no suman 100', () => {
    expect(validarPesos([30, 30, 30])).toBe('Los pesos suman 90,00 %; deben sumar 100 %.');
  });

  it('señala un peso faltante', () => {
    expect(validarPesos([30, undefined, 40])).toBe('Falta el peso de algún periodo.');
  });

  it('rechaza un peso de 0', () => {
    expect(validarPesos([0, 50, 50])).toBe('Cada peso debe ser mayor que 0 %.');
  });
});

describe('problemasConfiguracion', () => {
  const tres = [
    periodo('p1', '2026-02-01', '2026-03-31', { peso: 30 }),
    periodo('p2', '2026-04-01', '2026-05-31', { peso: 30 }),
    periodo('p3', '2026-06-01', '2026-07-31', { peso: 40 }),
  ];

  it('una configuración correcta no tiene problemas', () => {
    expect(problemasConfiguracion(anioBase, tres)).toEqual([]);
  });

  it('un año sin periodos lo reporta', () => {
    expect(problemasConfiguracion(anioBase, [])).toEqual(['El año no tiene periodos. Agrega al menos uno.']);
  });

  it('con pesos variables, un periodo nuevo sin peso se nombra por su número', () => {
    const variable: AnioLectivo = { ...anioBase, modoPesoPeriodos: 'varian' };
    const nuevo = periodo('p4', '2026-08-01', '2026-09-30');
    const problemas = problemasConfiguracion(variable, [...tres, nuevo]);
    expect(problemas).toContain('Periodo 4: falta su peso.');
  });

  it('con pesos variables que no suman 100, el mensaje muestra la suma', () => {
    const variable: AnioLectivo = { ...anioBase, modoPesoPeriodos: 'varian' };
    const malos = tres.map((p) => ({ ...p, peso: 25 }));
    expect(problemasConfiguracion(variable, malos)).toContain('Los pesos suman 75,00 %; deben sumar 100 %.');
  });

  it('con grupos iguales sin configurar (0/0/0) lo reporta', () => {
    const sinConfigurar: AnioLectivo = { ...anioBase, gruposIguales: { ser: 0, saber: 0, hacer: 0 } };
    expect(problemasConfiguracion(sinConfigurar, tres)[0]).toBe(
      'Falta configurar los porcentajes de Ser, Saber y Hacer para todos los periodos.',
    );
  });

  it('con grupos variables, el periodo indicado sin porcentajes se reporta', () => {
    const variable: AnioLectivo = { ...anioBase, modoGrupos: 'varian' };
    const conGrupos = tres.map((p) => ({ ...p, grupos: { ser: 20, saber: 50, hacer: 30 } }));
    const sinGrupos = [...conGrupos.slice(0, 1), { ...conGrupos[1], grupos: undefined }, conGrupos[2]];
    expect(problemasConfiguracion(variable, sinGrupos, 'p2')).toEqual([
      'Periodo 2: faltan los porcentajes de Ser, Saber y Hacer.',
    ]);
    expect(problemasConfiguracion(variable, sinGrupos, 'p1')).toEqual([]);
  });

  it('una fecha inválida se reporta con el número del periodo', () => {
    const malo = [...tres.slice(0, 1), periodo('p2', '2026-05-31', '2026-04-01', { peso: 70 })];
    const problemas = problemasConfiguracion(anioBase, malo);
    expect(problemas.some((m) => m.startsWith('Periodo 2: las fechas no son válidas'))).toBe(true);
  });
});

describe('actividadEnVacaciones', () => {
  const vacaciones = [{
    id: 'v1', anioLectivoId: 'a', tipo: 'vacaciones' as const, nombre: 'Mitad de año',
    fechaInicio: '2026-06-15', fechaFin: '2026-06-19',
  }];

  it('detecta una actividad dentro de vacaciones, incluidos los extremos', () => {
    expect(actividadEnVacaciones('2026-06-15', vacaciones)?.nombre).toBe('Mitad de año');
    expect(actividadEnVacaciones('2026-06-19', vacaciones)?.nombre).toBe('Mitad de año');
  });

  it('una actividad fuera de vacaciones devuelve null', () => {
    expect(actividadEnVacaciones('2026-06-20', vacaciones)).toBeNull();
  });
});
