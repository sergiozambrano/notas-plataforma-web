import { describe, expect, it } from 'vitest';
import type { Escala } from '@/core/tipos';
import { formatoNota, formatoNotaRegistrada, formatoNumero, parsearNota } from './notas';

const numerica2: Escala = { tipo: 'numerica', notaMin: 0, notaMax: 5, decimales: 2 };
const numerica1: Escala = { tipo: 'numerica', notaMin: 0, notaMax: 5, decimales: 1 };
const letras: Escala = {
  tipo: 'letras',
  letras: [
    { letra: 'E', equivalente: 1 },
    { letra: 'A+', equivalente: 5 },
    { letra: 'B', equivalente: 4 },
  ],
};

describe('formato con coma decimal', () => {
  it('formatoNumero usa coma y ceros fijos', () => {
    expect(formatoNumero(4.4, 2)).toBe('4,40');
    expect(formatoNumero(4.35, 2)).toBe('4,35');
    expect(formatoNumero(4.4, 1)).toBe('4,4');
  });

  it('formatoNota numérica usa los decimales de la escala', () => {
    expect(formatoNota(4.4, numerica2)).toBe('4,40');
    expect(formatoNota(4.4, numerica1)).toBe('4,4');
  });

  it('formatoNota por letras muestra la letra de mayor equivalente que no lo supere', () => {
    expect(formatoNota(4.5, letras)).toBe('B');
  });

  it('formatoNotaRegistrada muestra la letra en mayúscula canónica', () => {
    expect(formatoNotaRegistrada('b', letras)).toBe('B');
    expect(formatoNotaRegistrada(4.35, numerica2)).toBe('4,35');
  });
});

describe('parsearNota', () => {
  it('acepta coma', () => {
    expect(parsearNota('4,35', numerica2)).toEqual({ ok: true, valor: 4.35 });
  });

  it('acepta punto', () => {
    expect(parsearNota('4.35', numerica2)).toEqual({ ok: true, valor: 4.35 });
  });

  it('acepta 6,0 solo si cabe; con escala 0–5 es rechazada con el rango y decimales', () => {
    const r = parsearNota('6,0', numerica1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('Escribe una nota entre 0,0 y 5,0 con máximo 1 decimal.');
  });

  it('rechaza 4,355 con 2 decimales', () => {
    const r = parsearNota('4,355', numerica2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('máximo 2 decimales');
  });

  it('vacío es sin nota (null), nunca cero', () => {
    expect(parsearNota('', numerica2)).toEqual({ ok: true, valor: null });
    expect(parsearNota('   ', letras)).toEqual({ ok: true, valor: null });
  });

  it('rechaza formatos que no son decimales simples', () => {
    expect(parsearNota('1e3', numerica2).ok).toBe(false);
    expect(parsearNota('4,3,2', numerica2).ok).toBe(false);
  });

  it('en letras, una letra no definida se rechaza y el mensaje lista las válidas de mayor a menor', () => {
    const r = parsearNota('Z', letras);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Letras válidas: A+, B, E.');
  });

  it('en letras, acepta minúsculas y devuelve la letra canónica', () => {
    expect(parsearNota('b', letras)).toEqual({ ok: true, valor: 'B' });
  });
});
