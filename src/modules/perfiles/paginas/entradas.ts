/** Lee un número escrito con coma o punto. null si no es un número válido. */
export function leerDecimal(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(limpio)) return null;
  return Number(limpio.replace(',', '.'));
}

/** Número listo para un campo de entrada: coma decimal. */
export function textoEntrada(valor: number): string {
  return String(valor).replace('.', ',');
}
