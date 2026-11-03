/** Lee un número escrito con coma o punto. null si no es un número válido. */
export function leerDecimal(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(limpio)) return null;
  return Number(limpio.replace(',', '.'));
}

/** Número listo para un campo de entrada: coma decimal, sin ceros de relleno. */
export function textoNumero(valor: number): string {
  return String(valor).replace('.', ',');
}

const FORMATO_PORCENTAJE = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/** Porcentaje para mostrar: coma decimal, hasta 2 decimales ("33,33 %"). */
export function textoPorcentaje(valor: number): string {
  return `${FORMATO_PORCENTAJE.format(valor)} %`;
}
