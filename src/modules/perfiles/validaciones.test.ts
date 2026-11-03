import { describe, expect, it } from 'vitest';
import type { Escala, NivelesNacionales } from '@/core/tipos';
import {
  ajustarReglasAEscala, nivelesPorDefecto, validarEscala, validarNiveles, validarNotaAprobar,
} from './validaciones';

const numerica: Escala = { tipo: 'numerica', notaMin: 0, notaMax: 5, decimales: 1 };
const letras: Escala = {
  tipo: 'letras',
  letras: [
    { letra: 'A+', equivalente: 5 },
    { letra: 'B', equivalente: 4 },
    { letra: 'E', equivalente: 1 },
  ],
};
const niveles: NivelesNacionales = { bajo: 0, basico: 3, alto: 4, superior: 4.6 };

describe('validarEscala', () => {
  it('acepta la escala numérica por defecto', () => {
    expect(validarEscala(numerica)).toBeNull();
  });

  it('mínimo mayor o igual que el máximo es error', () => {
    expect(validarEscala({ tipo: 'numerica', notaMin: 5, notaMax: 5, decimales: 2 })).toEqual({
      notaMax: 'La nota máxima debe ser mayor que la mínima.',
    });
    expect(validarEscala({ tipo: 'numerica', notaMin: 5, notaMax: 0, decimales: 2 })).not.toBeNull();
  });

  it('los límites deben caber en los decimales elegidos', () => {
    expect(validarEscala({ tipo: 'numerica', notaMin: 0, notaMax: 5.25, decimales: 1 })).toEqual({
      notaMax: 'Usa máximo 1 decimal.',
    });
    expect(validarEscala({ tipo: 'numerica', notaMin: 0, notaMax: 5.25, decimales: 2 })).toBeNull();
  });

  it('decimales distintos de 1 o 2 es error', () => {
    expect(validarEscala({ tipo: 'numerica', notaMin: 0, notaMax: 5, decimales: 3 as 1 })).toHaveProperty('decimales');
  });

  it('letras repetidas (sin distinguir mayúsculas) es error', () => {
    const e = validarEscala({
      tipo: 'letras', letras: [{ letra: 'A', equivalente: 5 }, { letra: 'a', equivalente: 4 }],
    });
    expect(e).toHaveProperty('letras');
  });

  it('equivalentes repetidos es error', () => {
    const e = validarEscala({
      tipo: 'letras', letras: [{ letra: 'A', equivalente: 4 }, { letra: 'B', equivalente: 4 }],
    });
    expect(e).toHaveProperty('equivalentes');
  });

  it('escala por letras en cualquier orden es válida', () => {
    expect(validarEscala(letras)).toBeNull();
  });
});

describe('validarNiveles', () => {
  it('niveles crecientes dentro de la escala, con bajo = mínimo, son válidos', () => {
    expect(validarNiveles(niveles, numerica)).toBeNull();
  });

  it('inicios repetidos o no crecientes son error', () => {
    expect(validarNiveles({ bajo: 0, basico: 3, alto: 3, superior: 4 }, numerica)).toHaveProperty('alto');
    expect(validarNiveles({ bajo: 0, basico: 3, alto: 2, superior: 4 }, numerica)).toHaveProperty('alto');
  });

  it('un inicio fuera de la escala es error', () => {
    expect(validarNiveles({ bajo: 0, basico: 3, alto: 4, superior: 5.5 }, numerica)).toHaveProperty('superior');
  });

  it('bajo debe ser el mínimo de la escala', () => {
    expect(validarNiveles({ bajo: 0.5, basico: 3, alto: 4, superior: 4.6 }, numerica)).toHaveProperty('bajo');
  });
});

describe('validarNotaAprobar', () => {
  it('acepta una nota dentro de la escala con los decimales permitidos', () => {
    expect(validarNotaAprobar(3, numerica)).toBeNull();
  });

  it('rechaza más decimales de los permitidos', () => {
    expect(validarNotaAprobar(3.05, numerica)).not.toBeNull();
  });

  it('acepta una letra definida y rechaza una que no lo es', () => {
    expect(validarNotaAprobar('B', letras)).toBeNull();
    expect(validarNotaAprobar('Z', letras)).not.toBeNull();
  });
});

describe('niveles por defecto y reajuste de reglas', () => {
  it('en 0–5 con 1 decimal, los niveles por defecto son 0 / 3 / 4 / 4,6', () => {
    expect(nivelesPorDefecto(numerica)).toEqual({ bajo: 0, basico: 3, alto: 4, superior: 4.6 });
  });

  it('si los niveles y la nota para aprobar siguen cabiendo, se conservan', () => {
    const r = ajustarReglasAEscala({ notaAprobar: 3, nivelesNacionales: niveles }, numerica);
    expect(r).toEqual({ notaAprobar: 3, nivelesNacionales: niveles, ajustado: [] });
  });

  it('si solo los niveles ya no caben, se reajustan y la nota para aprobar se conserva', () => {
    const nuevaEscala: Escala = { tipo: 'numerica', notaMin: 1, notaMax: 10, decimales: 1 };
    const r = ajustarReglasAEscala({ notaAprobar: 3, nivelesNacionales: niveles }, nuevaEscala);
    expect(r.nivelesNacionales).toEqual({ bajo: 1, basico: 6.4, alto: 8.2, superior: 9.3 });
    expect(r.notaAprobar).toBe(3);
    expect(r.ajustado).toEqual(['los niveles nacionales']);
  });

  it('si la nota para aprobar ya no cabe, se reajusta a básico', () => {
    const nuevaEscala: Escala = { tipo: 'numerica', notaMin: 1, notaMax: 10, decimales: 1 };
    const r = ajustarReglasAEscala({ notaAprobar: 0.5, nivelesNacionales: niveles }, nuevaEscala);
    expect(r.notaAprobar).toBe(6.4);
    expect(r.ajustado).toEqual(['los niveles nacionales', 'la nota para aprobar']);
  });

  it('en letras, la nota para aprobar reajustada es la letra de menor equivalente ≥ básico', () => {
    // Niveles recalculados en escala 1–5: básico = 1 + 0,6 × 4 = 3,4; la menor letra ≥ 3,4 es B.
    const r = ajustarReglasAEscala({ notaAprobar: 'Q', nivelesNacionales: niveles }, letras);
    expect(r.notaAprobar).toBe('B');
    expect(r.nivelesNacionales.basico).toBe(3.4);
  });
});
