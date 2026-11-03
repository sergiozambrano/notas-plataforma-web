import { describe, expect, it } from 'vitest';
import type { AnioLectivo, Escala, LetraEscala, Periodo } from '@/core/tipos';
import { aNumero, compara, fraccion, suma } from './fraccion';
import {
  aprueba, calcularDefinitiva, calcularNotaPeriodo, letraDe, nivelNacional, pesosDePeriodos, redondear,
} from './calculo';

const numerica1: Escala = { tipo: 'numerica', notaMin: 0, notaMax: 5, decimales: 1 };
const numerica2: Escala = { tipo: 'numerica', notaMin: 0, notaMax: 5, decimales: 2 };
const letrasEscala: LetraEscala[] = [
  { letra: 'A+', equivalente: 5 },
  { letra: 'B', equivalente: 4 },
  { letra: 'E', equivalente: 1 },
];
const letras: Escala = { tipo: 'letras', letras: letrasEscala };
const pctStandard = { ser: 20, saber: 50, hacer: 30 };

describe('HU-19 cálculo de la nota del periodo', () => {
  it('HU-19.1: promedios 4,5 / 4,0 / 5,0 con 20/50/30 dan 4,4', () => {
    const nota = calcularNotaPeriodo(
      { ser: [4, 5], saber: [3, 5], hacer: [5] },
      pctStandard,
      numerica1,
    );
    expect(nota).toBe(4.4);
  });

  it('HU-19.2: con 2 decimales se muestra 3,93', () => {
    const notas = { ser: [3, 4, 4], saber: [4], hacer: [4] };
    expect(calcularNotaPeriodo(notas, pctStandard, numerica2)).toBe(3.93);
  });

  it('HU-19.2: con 1 decimal se muestra 3,9', () => {
    const notas = { ser: [3, 4, 4], saber: [4], hacer: [4] };
    expect(calcularNotaPeriodo(notas, pctStandard, numerica1)).toBe(3.9);
  });

  it('HU-19.3: con letras (A+ = 5, B = 4) el resultado 4,2 se muestra como B', () => {
    const nota = calcularNotaPeriodo(
      { ser: ['A+'], saber: ['B'], hacer: ['B'] },
      pctStandard,
      letras,
    );
    expect(nota).toBe(4.2);
    expect(letraDe(nota, letrasEscala)).toBe('B');
  });
});

describe('HU-20 nota definitiva y aprobación', () => {
  // Los pesos de calcularDefinitiva son porcentajes (30 = 30 %).
  const pesos30_30_40 = [fraccion(30), fraccion(30), fraccion(40)];

  it('HU-20.1: periodos 30/30/40 con notas 3,0 / 4,0 / 4,5 dan 3,9', () => {
    const definitiva = calcularDefinitiva(
      [
        { nota: 3, peso: pesos30_30_40[0] },
        { nota: 4, peso: pesos30_30_40[1] },
        { nota: 4.5, peso: pesos30_30_40[2] },
      ],
      numerica1,
    );
    expect(definitiva).toBe(3.9);
  });

  it('HU-20.2: 3,9 con Básico desde 3,0 y Alto desde 4,0 queda en Básico', () => {
    const niveles = { bajo: 0, basico: 3, alto: 4, superior: 4.6 };
    expect(nivelNacional(3.9, niveles)).toBe('Básico');
  });

  it('HU-20.4: nota para aprobar 3,0 → 3,0 aprueba y 2,9 no aprueba', () => {
    const perfil = { escala: numerica1, notaAprobar: 3 };
    expect(aprueba(3, perfil)).toBe(true);
    expect(aprueba(2.9, perfil)).toBe(false);
  });

  it('HU-20.5: con letras y B para aprobar, 4,2 (B) aprueba y 3,5 (E) no aprueba', () => {
    const perfil = { escala: letras, notaAprobar: 'B' };
    expect(letraDe(4.2, letrasEscala)).toBe('B');
    expect(aprueba(4.2, perfil)).toBe(true);
    expect(letraDe(3.5, letrasEscala)).toBe('E');
    expect(aprueba(3.5, perfil)).toBe(false);
  });
});

describe('redondeo mitad hacia arriba (solo resultado final)', () => {
  it('1,005 a 2 decimales da 1,01', () => {
    expect(redondear(fraccion('1.005'), 2)).toBe(1.01);
  });

  it('2,675 a 2 decimales da 2,68', () => {
    expect(redondear(fraccion('2.675'), 2)).toBe(2.68);
  });

  it('3,9333 se redondea a 3,93 con 2 decimales y a 3,9 con 1', () => {
    expect(redondear(fraccion('3,9333'), 2)).toBe(3.93);
    expect(redondear(fraccion('3,9333'), 1)).toBe(3.9);
  });

  it('0,5 a 0 decimales sube a 1 y 0,4 baja a 0', () => {
    expect(redondear(fraccion('0.5'), 0)).toBe(1);
    expect(redondear(fraccion('0.4'), 0)).toBe(0);
  });
});

describe('pesos de periodos', () => {
  const anioIguales: AnioLectivo = {
    id: 'a', perfilId: 'p', anio: 2026, modoPesoPeriodos: 'iguales', modoGrupos: 'iguales',
    gruposIguales: { ser: 20, saber: 50, hacer: 30 },
  };
  const periodos: Periodo[] = ['p1', 'p2', 'p3'].map((id) => ({
    id, anioLectivoId: 'a', fechaInicio: '2026-01-01', fechaFin: '2026-02-01',
  }));

  it('con 3 periodos iguales cada uno pesa 100/3 exacto', () => {
    const pesos = pesosDePeriodos(anioIguales, periodos);
    expect(pesos.p1).toEqual({ n: 100n, d: 3n });
    expect(pesos.p2).toEqual({ n: 100n, d: 3n });
    expect(pesos.p3).toEqual({ n: 100n, d: 3n });
    const total = suma(suma(pesos.p1, pesos.p2), pesos.p3);
    expect(compara(total, fraccion(100))).toBe(0);
  });

  it('con 4 periodos iguales cada uno pesa 25', () => {
    const cuatro = [...periodos, { ...periodos[0], id: 'p4' }];
    expect(aNumero(pesosDePeriodos(anioIguales, cuatro).p4)).toBe(25);
  });

  it('con pesos variables usa el peso de cada periodo', () => {
    const variable: AnioLectivo = { ...anioIguales, modoPesoPeriodos: 'varian' };
    const conPeso = periodos.map((p, i) => ({ ...p, peso: [30, 30, 40][i] }));
    const pesos = pesosDePeriodos(variable, conPeso);
    expect(aNumero(pesos.p3)).toBe(40);
  });
});

describe('letras y valores', () => {
  it('letraDe(4,5) con A+ = 5, B = 4, E = 1 es B', () => {
    expect(letraDe(4.5, letrasEscala)).toBe('B');
  });

  it('un valor menor que todas las letras muestra la menor', () => {
    expect(letraDe(0.5, letrasEscala)).toBe('E');
  });
});
