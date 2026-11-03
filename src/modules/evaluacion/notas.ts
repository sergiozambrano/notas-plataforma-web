// Presentación y entrada de notas: funciones puras.
import type { Escala, ValorNota } from '@/core/tipos';
import { fraccion } from './fraccion';
import { buscarLetra, decimalesDe, letraDe, notaMaxima, notaMinima, redondear } from './calculo';

export type ResultadoParseo = { ok: true; valor: ValorNota | null } | { ok: false; error: string };

export function formatoNumero(valor: number, decimales: number): string {
  return redondear(fraccion(valor), decimales).toFixed(decimales).replace('.', ',');
}

export function formatoNota(valor: number, escala: Escala): string {
  return escala.tipo === 'numerica'
    ? formatoNumero(valor, escala.decimales)
    : letraDe(valor, escala.letras);
}

export function formatoNotaRegistrada(valor: ValorNota, escala: Escala): string {
  if (typeof valor === 'number') return formatoNota(valor, escala);
  if (escala.tipo === 'letras') return buscarLetra(valor, escala.letras)?.letra ?? valor;
  const n = Number(valor.trim().replace(',', '.'));
  return Number.isFinite(n) ? formatoNumero(n, escala.decimales) : valor;
}

export function parsearNota(texto: string, escala: Escala): ResultadoParseo {
  const t = texto.trim();
  if (t === '') return { ok: true, valor: null };

  if (escala.tipo === 'letras') {
    const letra = buscarLetra(t, escala.letras);
    if (!letra) {
      const validas = [...escala.letras]
        .sort((a, b) => b.equivalente - a.equivalente)
        .map((l) => l.letra)
        .join(', ');
      return { ok: false, error: `La letra "${t}" no está definida. Letras válidas: ${validas}.` };
    }
    return { ok: true, valor: letra.letra };
  }

  const d = decimalesDe(escala);
  const mensaje = `Escribe una nota entre ${formatoNumero(notaMinima(escala), d)} y ${formatoNumero(notaMaxima(escala), d)} con máximo ${d} decimal${d === 1 ? '' : 'es'}.`;
  if (!/^\d+(?:[.,]\d+)?$/.test(t)) return { ok: false, error: mensaje };
  const decimalesEscritos = t.split(/[.,]/)[1] ?? '';
  if (decimalesEscritos.length > d) return { ok: false, error: mensaje };
  const valor = Number(t.replace(',', '.'));
  if (valor < notaMinima(escala) || valor > notaMaxima(escala)) return { ok: false, error: mensaje };
  return { ok: true, valor };
}
