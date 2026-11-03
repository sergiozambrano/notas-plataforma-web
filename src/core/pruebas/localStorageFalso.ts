/** Doble de localStorage para pruebas en entorno node. */
export class LocalStorageFalso {
  private datos = new Map<string, string>();

  get length(): number {
    return this.datos.size;
  }

  key(indice: number): string | null {
    return Array.from(this.datos.keys())[indice] ?? null;
  }

  getItem(clave: string): string | null {
    return this.datos.get(clave) ?? null;
  }

  setItem(clave: string, valor: string): void {
    this.datos.set(clave, String(valor));
  }

  removeItem(clave: string): void {
    this.datos.delete(clave);
  }

  clear(): void {
    this.datos.clear();
  }
}

/** Instala un localStorage falso en globalThis y lo devuelve. Cada llamada empieza vacío. */
export function instalarLocalStorageFalso(): LocalStorageFalso {
  const falso = new LocalStorageFalso();
  Object.defineProperty(globalThis, 'localStorage', { value: falso, configurable: true, writable: true });
  return falso;
}
