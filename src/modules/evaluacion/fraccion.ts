/** Aritmética racional exacta (sin punto flotante, regla 3). d siempre > 0 y la fracción queda reducida. */
export interface Fraccion {
  n: bigint;
  d: bigint;
}

export const CERO: Fraccion = { n: 0n, d: 1n };

function mcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

function reducir(n: bigint, d: bigint): Fraccion {
  if (d === 0n) throw new RangeError('Denominador cero');
  const signo = d < 0n ? -1n : 1n;
  const num = n * signo;
  const den = d * signo;
  const g = mcd(num, den);
  return { n: num / g, d: den / g };
}

/** Lee un decimal por su representación (coma o punto; admite notación exponencial). */
export function fraccion(x: number | string): Fraccion {
  let texto: string;
  if (typeof x === 'number') {
    if (!Number.isFinite(x)) throw new RangeError(`Número no válido: ${x}`);
    texto = String(x);
  } else {
    texto = x.trim();
  }
  const m = /^([+-]?)(\d*)(?:[.,](\d*))?(?:[eE]([+-]?\d+))?$/.exec(texto);
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) throw new RangeError(`Número no válido: ${texto}`);
  const decimales = m[3] ?? '';
  const digitos = (m[2] ?? '') + decimales;
  const exponente = Number(m[4] ?? 0);
  let n = BigInt(digitos === '' ? '0' : digitos);
  if (m[1] === '-') n = -n;
  const escala = decimales.length - exponente;
  if (escala >= 0) return reducir(n, 10n ** BigInt(escala));
  return reducir(n * 10n ** BigInt(-escala), 1n);
}

export function suma(a: Fraccion, b: Fraccion): Fraccion {
  return reducir(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function resta(a: Fraccion, b: Fraccion): Fraccion {
  return reducir(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function multiplica(a: Fraccion, b: Fraccion): Fraccion {
  return reducir(a.n * b.n, a.d * b.d);
}

export function divide(a: Fraccion, b: Fraccion): Fraccion {
  if (b.n === 0n) throw new RangeError('División entre cero');
  return reducir(a.n * b.d, a.d * b.n);
}

/** -1, 0 o 1. */
export function compara(a: Fraccion, b: Fraccion): number {
  const izq = a.n * b.d;
  const der = b.n * a.d;
  if (izq < der) return -1;
  if (izq > der) return 1;
  return 0;
}

export function aNumero(f: Fraccion): number {
  return Number(f.n) / Number(f.d);
}

/** Convierte un porcentaje (30 → 30/100). */
export function porcentaje(x: number | string): Fraccion {
  return divide(fraccion(x), fraccion(100));
}
