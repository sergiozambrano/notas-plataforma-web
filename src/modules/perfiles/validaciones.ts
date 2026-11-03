// Validaciones de escala, niveles y nota para aprobar: funciones puras.
import type { Escala, NivelesNacionales, Perfil, ValorNota } from '@/core/tipos';
import { fraccion, multiplica, porcentaje, resta, suma } from '@/modules/evaluacion/fraccion';
import { buscarLetra, decimalesDe, notaMaxima, notaMinima, redondear } from '@/modules/evaluacion/calculo';
import { formatoNumero } from '@/modules/evaluacion/notas';

const ETIQUETAS_NIVEL: Record<keyof NivelesNacionales, string> = {
  bajo: 'Bajo', basico: 'Básico', alto: 'Alto', superior: 'Superior',
};
const ORDEN_NIVEL: (keyof NivelesNacionales)[] = ['bajo', 'basico', 'alto', 'superior'];

export function validarEscala(escala: Escala): Record<string, string> | null {
  const errores: Record<string, string> = {};
  if (escala.tipo === 'numerica') {
    if (!Number.isFinite(escala.notaMin)) errores.notaMin = 'Escribe una nota mínima válida.';
    if (!Number.isFinite(escala.notaMax)) errores.notaMax = 'Escribe una nota máxima válida.';
    if (!errores.notaMin && !errores.notaMax && escala.notaMin >= escala.notaMax) {
      errores.notaMax = 'La nota máxima debe ser mayor que la mínima.';
    }
    if (escala.decimales !== 1 && escala.decimales !== 2) errores.decimales = 'Los decimales deben ser 1 o 2.';
    if (escala.decimales === 1 || escala.decimales === 2) {
      // Los límites también deben caber en los decimales elegidos (si no, la nota máxima sería inalcanzable).
      const factor = 10n ** BigInt(escala.decimales);
      const cabe = (x: number): boolean => Number.isFinite(x) && factor % fraccion(x).d === 0n;
      if (!errores.notaMin && !cabe(escala.notaMin)) {
        errores.notaMin = `Usa máximo ${escala.decimales} decimal${escala.decimales === 1 ? '' : 'es'}.`;
      }
      if (!errores.notaMax && !cabe(escala.notaMax)) {
        errores.notaMax = `Usa máximo ${escala.decimales} decimal${escala.decimales === 1 ? '' : 'es'}.`;
      }
    }
    return Object.keys(errores).length > 0 ? errores : null;
  }

  if (escala.letras.length === 0) errores.letras = 'Agrega al menos una letra.';
  const letrasVistas = new Set<string>();
  const equivalentesVistos = new Set<number>();
  for (const l of escala.letras) {
    const clave = l.letra.trim().toLowerCase();
    if (clave === '') errores.letras = 'Todas las letras necesitan texto.';
    else if (letrasVistas.has(clave)) errores.letras = `La letra ${l.letra.trim()} está repetida.`;
    letrasVistas.add(clave);

    if (!Number.isFinite(l.equivalente)) errores.equivalentes = 'Cada letra necesita un equivalente numérico.';
    else if (equivalentesVistos.has(l.equivalente)) {
      errores.equivalentes = `El equivalente ${formatoNumero(l.equivalente, 2)} está repetido.`;
    }
    equivalentesVistos.add(l.equivalente);
  }
  return Object.keys(errores).length > 0 ? errores : null;
}

/** Niveles: bajo = mínimo de la escala, y cada inicio estrictamente mayor que el anterior y dentro de la escala. */
export function validarNiveles(niveles: NivelesNacionales, escala: Escala): Record<string, string> | null {
  const min = notaMinima(escala);
  const max = notaMaxima(escala);
  const d = decimalesDe(escala);
  const errores: Record<string, string> = {};
  ORDEN_NIVEL.forEach((clave, i) => {
    const valor = niveles[clave];
    if (!Number.isFinite(valor)) {
      errores[clave] = 'Escribe un valor numérico.';
      return;
    }
    if (valor < min || valor > max) {
      errores[clave] = `Debe estar entre ${formatoNumero(min, d)} y ${formatoNumero(max, d)}.`;
      return;
    }
    if (i === 0 && valor !== min) {
      errores[clave] = `Bajo debe ser ${formatoNumero(min, d)}, la nota mínima de la escala.`;
      return;
    }
    if (i > 0) {
      const anterior = ORDEN_NIVEL[i - 1];
      if (valor <= niveles[anterior]) {
        errores[clave] = `Debe ser mayor que el inicio de ${ETIQUETAS_NIVEL[anterior]}.`;
      }
    }
  });
  return Object.keys(errores).length > 0 ? errores : null;
}

export function validarNotaAprobar(valor: ValorNota, escala: Escala): string | null {
  if (escala.tipo === 'letras') {
    if (typeof valor !== 'string' || !buscarLetra(valor, escala.letras)) return 'Elige una letra de la escala.';
    return null;
  }
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 'Escribe la nota para aprobar como número.';
  const min = notaMinima(escala);
  const max = notaMaxima(escala);
  const d = decimalesDe(escala);
  if (valor < min || valor > max) {
    return `La nota para aprobar debe estar entre ${formatoNumero(min, d)} y ${formatoNumero(max, d)}.`;
  }
  const f = fraccion(valor);
  if ((10n ** BigInt(d)) % f.d !== 0n) return `Usa máximo ${d} decimal${d === 1 ? '' : 'es'}.`;
  return null;
}

/** Niveles por defecto para la escala: bajo = mínimo; básico, alto y superior al 60 %, 80 % y 92 % del rango. */
export function nivelesPorDefecto(escala: Escala): NivelesNacionales {
  const min = fraccion(notaMinima(escala));
  const rango = resta(fraccion(notaMaxima(escala)), min);
  const d = decimalesDe(escala);
  const en = (p: number): number => redondear(suma(min, multiplica(rango, porcentaje(p))), d);
  return { bajo: redondear(min, d), basico: en(60), alto: en(80), superior: en(92) };
}

export interface ReglasAjustadas {
  notaAprobar: ValorNota;
  nivelesNacionales: NivelesNacionales;
  /** Qué valores tuvieron que reajustarse. */
  ajustado: string[];
}

/**
 * Conserva la nota para aprobar y los niveles si siguen cabiendo en la nueva escala;
 * si no, los reajusta. Aprobar = básico (en letras: la letra de menor equivalente ≥ básico).
 */
export function ajustarReglasAEscala(
  perfil: Pick<Perfil, 'notaAprobar' | 'nivelesNacionales'>,
  escala: Escala,
): ReglasAjustadas {
  const ajustado: string[] = [];

  let niveles = perfil.nivelesNacionales;
  if (validarNiveles(niveles, escala) !== null) {
    niveles = nivelesPorDefecto(escala);
    ajustado.push('los niveles nacionales');
  }

  let notaAprobar = perfil.notaAprobar;
  if (validarNotaAprobar(notaAprobar, escala) !== null) {
    notaAprobar = aprobarPorDefecto(escala, niveles.basico);
    ajustado.push('la nota para aprobar');
  }

  return { notaAprobar, nivelesNacionales: niveles, ajustado };
}

function aprobarPorDefecto(escala: Escala, basico: number): ValorNota {
  if (escala.tipo === 'numerica') return basico;
  const ordenadas = [...escala.letras].sort((a, b) => a.equivalente - b.equivalente);
  const elegida = ordenadas.find((l) => l.equivalente >= basico) ?? ordenadas[ordenadas.length - 1];
  return elegida.letra;
}
