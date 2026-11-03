// Funciones PURAS: sin Date, storage ni imports de core salvo tipos.
import type {
  AnioLectivo, Escala, Grupo, LetraEscala, NivelesNacionales, Perfil, Periodo,
  PorcentajesGrupos, ValorNota,
} from '@/core/tipos';
import { GRUPOS } from '@/core/tipos';
import {
  CERO, compara, divide, fraccion, Fraccion, multiplica, porcentaje, suma,
} from './fraccion';

/** Redondeo estándar (mitad hacia arriba), exacto con BigInt. Solo se usa en resultados finales. */
export function redondear(valor: Fraccion, decimales: number): number {
  const factor = 10n ** BigInt(decimales);
  const numerador = 2n * valor.n * factor + valor.d;
  const denominador = 2n * valor.d;
  let q = numerador / denominador;
  if (numerador % denominador !== 0n && numerador < 0n) q -= 1n;
  return Number(q) / Number(factor);
}

export function decimalesDe(escala: Escala): number {
  return escala.tipo === 'numerica' ? escala.decimales : 2;
}

export function buscarLetra(texto: string, letras: LetraEscala[]): LetraEscala | undefined {
  const clave = texto.trim().toLowerCase();
  return letras.find((l) => l.letra.trim().toLowerCase() === clave);
}

export function valorNumerico(valor: ValorNota, escala: Escala): number {
  if (typeof valor === 'number') return valor;
  if (escala.tipo === 'numerica') {
    const n = Number(valor.trim().replace(',', '.'));
    if (!Number.isFinite(n)) throw new RangeError(`Nota no válida: ${valor}`);
    return n;
  }
  const letra = buscarLetra(valor, escala.letras);
  if (!letra) throw new RangeError(`Letra no definida: ${valor}`);
  return letra.equivalente;
}

export function notaMaxima(escala: Escala): number {
  return escala.tipo === 'numerica' ? escala.notaMax : Math.max(...escala.letras.map((l) => l.equivalente));
}

export function notaMinima(escala: Escala): number {
  return escala.tipo === 'numerica' ? escala.notaMin : Math.min(...escala.letras.map((l) => l.equivalente));
}

export function calcularNotaPeriodo(
  notas: Record<Grupo, ValorNota[]>,
  pct: PorcentajesGrupos,
  escala: Escala,
): number {
  let total: Fraccion = CERO;
  for (const grupo of GRUPOS) {
    const valores = notas[grupo];
    if (valores.length === 0) throw new RangeError(`El grupo ${grupo} no tiene notas.`);
    const suma_ = valores.reduce((acc, v) => suma(acc, fraccion(valorNumerico(v, escala))), CERO);
    const promedio = divide(suma_, fraccion(valores.length));
    total = suma(total, multiplica(porcentaje(pct[grupo]), promedio));
  }
  return redondear(total, decimalesDe(escala));
}

/** Porcentaje de cada periodo (30 = 30 %). Iguales: 100 / n exacto. */
export function pesosDePeriodos(anio: AnioLectivo, periodos: Periodo[]): Record<string, Fraccion> {
  const salida: Record<string, Fraccion> = {};
  if (anio.modoPesoPeriodos === 'iguales') {
    if (periodos.length === 0) return salida;
    const cuota = divide(fraccion(100), fraccion(periodos.length));
    for (const p of periodos) salida[p.id] = cuota;
    return salida;
  }
  for (const p of periodos) salida[p.id] = fraccion(p.peso ?? 0);
  return salida;
}

/** items.peso es un porcentaje (30 = 30 %). */
export function calcularDefinitiva(items: { nota: number; peso: Fraccion }[], escala: Escala): number {
  const total = items.reduce(
    (acc, it) => suma(acc, multiplica(divide(it.peso, fraccion(100)), fraccion(it.nota))),
    CERO,
  );
  return redondear(total, decimalesDe(escala));
}

export function letraDe(valor: number, letras: LetraEscala[]): string {
  if (letras.length === 0) throw new RangeError('La escala no tiene letras.');
  const ordenadas = [...letras].sort((a, b) => b.equivalente - a.equivalente);
  const elegida = ordenadas.find((l) => l.equivalente <= valor) ?? ordenadas[ordenadas.length - 1];
  return elegida.letra;
}

export type NivelNacional = 'Bajo' | 'Básico' | 'Alto' | 'Superior';

export function nivelNacional(valor: number, niveles: NivelesNacionales): NivelNacional {
  const candidatos: { inicio: number; nombre: NivelNacional }[] = [
    { inicio: niveles.superior, nombre: 'Superior' },
    { inicio: niveles.alto, nombre: 'Alto' },
    { inicio: niveles.basico, nombre: 'Básico' },
    { inicio: niveles.bajo, nombre: 'Bajo' },
  ];
  candidatos.sort((a, b) => b.inicio - a.inicio);
  const hit = candidatos.find((c) => c.inicio <= valor);
  return hit ? hit.nombre : 'Bajo';
}

export function aprueba(definitiva: number, perfil: Pick<Perfil, 'escala' | 'notaAprobar'>): boolean {
  const umbral = typeof perfil.notaAprobar === 'number'
    ? perfil.notaAprobar
    : valorNumerico(perfil.notaAprobar, perfil.escala);
  return compara(fraccion(definitiva), fraccion(umbral)) >= 0;
}
