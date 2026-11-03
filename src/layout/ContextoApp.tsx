import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AnioLectivo, Perfil, Usuario } from '@/core/tipos';
import { motivoSoloLectura } from '@/core/bloqueos';
import { anioActual } from '@/core/reloj';
import * as auth from '@/modules/auth/auth.servicio';
import * as perfilesServicio from '@/modules/perfiles/perfiles.servicio';
import * as aniosServicio from '@/modules/anios/anios.servicio';

export interface ValorApp {
  usuario: Usuario | null;
  perfiles: Perfil[];
  perfil: Perfil | null;
  anios: AnioLectivo[];
  anio: AnioLectivo | null;
  /** true si el perfil o el año están en solo consulta (regla 9d). */
  soloLectura: boolean;
  motivoSoloLectura: string | null;
  cargando: boolean;
  seleccionarPerfil: (perfilId: string) => Promise<void>;
  seleccionarAnio: (anioId: string) => Promise<void>;
  /** Fija perfil y año a la vez (para las rutas con id). Úsalo en vez de dos llamadas seguidas. */
  sincronizar: (perfilId: string, anioId: string | null) => Promise<void>;
  recargar: () => Promise<void>;
}

interface Estado {
  cargando: boolean;
  usuario: Usuario | null;
  perfiles: Perfil[];
  perfil: Perfil | null;
  anios: AnioLectivo[];
  anio: AnioLectivo | null;
}

interface Preferencia {
  perfilId?: string | null;
  anioId?: string | null;
}

const ESTADO_INICIAL: Estado = {
  cargando: true, usuario: null, perfiles: [], perfil: null, anios: [], anio: null,
};

const ContextoAppReact = createContext<ValorApp | null>(null);

function claveSeleccion(usuarioId: string): string {
  return `gestion-notas:seleccion:${usuarioId}`;
}

/** Selección guardada por usuario. Si el navegador no deja leer, no hay selección. */
function leerSeleccion(usuarioId: string): Preferencia | null {
  try {
    const crudo = localStorage.getItem(claveSeleccion(usuarioId));
    return crudo === null ? null : (JSON.parse(crudo) as Preferencia);
  } catch {
    return null;
  }
}

function guardarSeleccion(usuarioId: string, perfilId: string | null, anioId: string | null): void {
  try {
    localStorage.setItem(claveSeleccion(usuarioId), JSON.stringify({ perfilId, anioId }));
  } catch {
    // Sin almacenamiento la selección solo dura lo que la página.
  }
}

/**
 * Perfil: el pedido, si existe; si no, el primero. Año: el pedido, si existe;
 * si no, el actual; si no, el más reciente.
 */
async function resolverSeleccion(pedido: Preferencia | undefined): Promise<Estado> {
  const usuario = await auth.usuarioActual();
  if (!usuario) return { ...ESTADO_INICIAL, cargando: false };

  const preferencia = pedido ?? leerSeleccion(usuario.id) ?? {};
  const perfiles = await perfilesServicio.listarPerfiles();
  const perfil = perfiles.find((p) => p.id === preferencia.perfilId) ?? perfiles[0] ?? null;
  const anios = perfil ? await aniosServicio.listarAnios(perfil.id) : [];
  const anio =
    anios.find((a) => a.id === preferencia.anioId) ??
    anios.find((a) => a.anio === anioActual()) ??
    anios[0] ??
    null;
  return { cargando: false, usuario, perfiles, perfil, anios, anio };
}

/** Perfil y año seleccionados, compartidos por todas las páginas internas. */
export function ContextoApp({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(ESTADO_INICIAL);
  const version = useRef(0);
  const actual = useRef<{ perfilId: string | null; anioId: string | null }>({ perfilId: null, anioId: null });

  const aplicar = useCallback(async (pedido: Preferencia | undefined) => {
    const miVersion = ++version.current;
    const nuevo = await resolverSeleccion(pedido);
    if (miVersion !== version.current) return;
    actual.current = { perfilId: nuevo.perfil?.id ?? null, anioId: nuevo.anio?.id ?? null };
    setEstado(nuevo);
    if (nuevo.usuario) guardarSeleccion(nuevo.usuario.id, actual.current.perfilId, actual.current.anioId);
  }, []);

  useEffect(() => {
    void aplicar(undefined);
  }, [aplicar]);

  const valor = useMemo<ValorApp>(() => {
    const motivo = estado.perfil && estado.anio ? motivoSoloLectura(estado.perfil, estado.anio) : null;
    return {
      usuario: estado.usuario,
      perfiles: estado.perfiles,
      perfil: estado.perfil,
      anios: estado.anios,
      anio: estado.anio,
      soloLectura: motivo !== null,
      motivoSoloLectura: motivo,
      cargando: estado.cargando,
      seleccionarPerfil: (perfilId) => aplicar({ perfilId, anioId: null }),
      seleccionarAnio: (anioId) => aplicar({ perfilId: actual.current.perfilId, anioId }),
      sincronizar: (perfilId, anioId) => aplicar({ perfilId, anioId }),
      recargar: () => aplicar({ perfilId: actual.current.perfilId, anioId: actual.current.anioId }),
    };
  }, [estado, aplicar]);

  return <ContextoAppReact.Provider value={valor}>{children}</ContextoAppReact.Provider>;
}

export function useApp(): ValorApp {
  const valor = useContext(ContextoAppReact);
  if (!valor) throw new Error('useApp debe usarse dentro de <ContextoApp>.');
  return valor;
}
