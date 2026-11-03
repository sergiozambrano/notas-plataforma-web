import type { BaseDatos, Escala, Nota, NivelesNacionales, Perfil, ValorNota } from '@/core/tipos';
import { ErrorAdvertencia, ErrorNegocio, ErrorValidacion } from '@/core/errores';
import { escribirDb, leerDb } from '@/core/almacen';
import { exigirUsuarioId } from '@/core/sesion';
import { anioActual } from '@/core/reloj';
import { nuevoId } from '@/core/ids';
import { perfilPropio } from '@/core/acceso';
import {
  asegurarPerfilActivo, asegurarReglasPerfil, perfilConCierres,
} from '@/core/bloqueos';
import { borrarPerfil, lineaConteo } from '@/core/cascadas';
import { buscarLetra } from '@/modules/evaluacion/calculo';
import {
  ajustarReglasAEscala, validarEscala, validarNiveles, validarNotaAprobar,
} from './validaciones';

/** Notas de todos los años del perfil. */
function notasDelPerfil(db: BaseDatos, perfilId: string): Nota[] {
  const anioIds = new Set(db.anios.filter((a) => a.perfilId === perfilId).map((a) => a.id));
  const cursoIds = new Set(db.cursos.filter((c) => anioIds.has(c.anioLectivoId)).map((c) => c.id));
  const asignacionIds = new Set(db.asignaciones.filter((a) => cursoIds.has(a.cursoId)).map((a) => a.id));
  const actividadIds = new Set(db.actividades.filter((a) => asignacionIds.has(a.asignacionId)).map((a) => a.id));
  return db.notas.filter((n) => actividadIds.has(n.actividadId));
}

/** Una nota "cabe" si es válida en la escala dada. */
function notaCabe(valor: ValorNota, escala: Escala): boolean {
  if (escala.tipo === 'letras') return typeof valor === 'string' && buscarLetra(valor, escala.letras) !== undefined;
  return typeof valor === 'number' && validarNotaAprobar(valor, escala) === null;
}

function asegurarNombreLibre(db: BaseDatos, usuarioId: string, nombre: string, excluirId: string | null): void {
  const clave = nombre.toLowerCase();
  const repetido = db.perfiles.some(
    (p) => p.usuarioId === usuarioId && p.id !== excluirId && p.nombre.trim().toLowerCase() === clave,
  );
  if (repetido) throw new ErrorValidacion({ nombre: 'Ya tienes un perfil con ese nombre.' });
}

function nombreObligatorio(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio === '') throw new ErrorValidacion({ nombre: 'Escribe el nombre de la institución.' });
  return limpio;
}

export async function listarPerfiles(): Promise<Perfil[]> {
  const usuarioId = exigirUsuarioId();
  return leerDb()
    .perfiles.filter((p) => p.usuarioId === usuarioId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
}

export async function obtenerPerfil(id: string): Promise<Perfil> {
  return perfilPropio(leerDb(), id);
}

export async function crearPerfil(nombre: string): Promise<Perfil> {
  const usuarioId = exigirUsuarioId();
  const limpio = nombreObligatorio(nombre);
  const salida: { perfil?: Perfil } = {};
  escribirDb((db) => {
    asegurarNombreLibre(db, usuarioId, limpio, null);
    const perfilId = nuevoId();
    const perfil: Perfil = {
      id: perfilId,
      usuarioId,
      nombre: limpio,
      activo: true,
      escala: { tipo: 'numerica', notaMin: 0, notaMax: 5, decimales: 2 },
      notaAprobar: 3,
      nivelesNacionales: { bajo: 0, basico: 3, alto: 4, superior: 4.6 },
      asistenciaObligatoria: false,
    };
    db.perfiles.push(perfil);
    db.anios.push({
      id: nuevoId(),
      perfilId,
      anio: anioActual(),
      modoPesoPeriodos: 'iguales',
      modoGrupos: 'iguales',
      gruposIguales: { ser: 0, saber: 0, hacer: 0 },
    });
    salida.perfil = perfil;
  });
  if (!salida.perfil) throw new ErrorNegocio('No se pudo crear el perfil.');
  return salida.perfil;
}

export async function renombrarPerfil(id: string, nombre: string): Promise<void> {
  const limpio = nombreObligatorio(nombre);
  escribirDb((db) => {
    const perfil = perfilPropio(db, id);
    asegurarPerfilActivo(db, id);
    asegurarNombreLibre(db, perfil.usuarioId, limpio, id);
    perfil.nombre = limpio;
  });
}

/** Activar o desactivar: permitido siempre (es la forma de reactivar un perfil). */
export async function cambiarActivo(id: string, activo: boolean): Promise<void> {
  escribirDb((db) => {
    perfilPropio(db, id).activo = activo;
  });
}

/**
 * Cambia la escala del perfil. Si hay notas registradas pide confirmación; con
 * `confirmado` borra las que no caben y reajusta nota para aprobar y niveles si
 * ya no caben. Devuelve un mensaje con lo que se cambió, o null.
 */
export async function guardarEscala(
  id: string,
  escala: Escala,
  opciones: { confirmado?: boolean } = {},
): Promise<string | null> {
  const errores = validarEscala(escala);
  if (errores) throw new ErrorValidacion(errores);

  const salida: { mensaje: string | null } = { mensaje: null };
  escribirDb((db) => {
    const perfil = perfilPropio(db, id);
    asegurarPerfilActivo(db, id);
    if (JSON.stringify(perfil.escala) === JSON.stringify(escala)) return;
    asegurarReglasPerfil(db, id);

    const notas = notasDelPerfil(db, id);
    const noCaben = notas.filter((n) => !notaCabe(n.valor, escala));
    if (notas.length > 0 && !opciones.confirmado) {
      const detalle = noCaben.length > 0
        ? `${lineaConteo(noCaben.length, 'nota no cabe', 'notas no caben')} en la nueva escala y se borrará.`
        : `Hay ${lineaConteo(notas.length, 'nota registrada', 'notas registradas')}; todas caben en la nueva escala.`;
      throw new ErrorAdvertencia(`${detalle} ¿Quieres cambiar la escala de todos modos?`);
    }

    const aBorrar = new Set<Nota>(noCaben);
    for (let i = db.notas.length - 1; i >= 0; i--) {
      if (aBorrar.has(db.notas[i])) db.notas.splice(i, 1);
    }

    perfil.escala = escala;
    const ajuste = ajustarReglasAEscala(perfil, escala);
    perfil.notaAprobar = ajuste.notaAprobar;
    perfil.nivelesNacionales = ajuste.nivelesNacionales;

    const partes: string[] = [];
    if (noCaben.length > 0) partes.push(`Se borraron ${lineaConteo(noCaben.length, 'nota que no cabe', 'notas que no caben')}.`);
    if (ajuste.ajustado.length > 0) partes.push(`Se reajustaron ${ajuste.ajustado.join(' y ')}.`);
    salida.mensaje = partes.length > 0 ? partes.join(' ') : null;
  });
  return salida.mensaje;
}

export async function guardarAprobacion(id: string, notaAprobar: ValorNota, niveles: NivelesNacionales): Promise<void> {
  escribirDb((db) => {
    const perfil = perfilPropio(db, id);
    asegurarPerfilActivo(db, id);
    asegurarReglasPerfil(db, id);

    const errores: Record<string, string> = {};
    const errorAprobar = validarNotaAprobar(notaAprobar, perfil.escala);
    if (errorAprobar) errores.notaAprobar = errorAprobar;
    Object.assign(errores, validarNiveles(niveles, perfil.escala) ?? {});
    if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);

    perfil.notaAprobar = notaAprobar;
    perfil.nivelesNacionales = { ...niveles };
  });
}

export async function guardarAsistencia(id: string, valor: boolean): Promise<void> {
  escribirDb((db) => {
    const perfil = perfilPropio(db, id);
    asegurarPerfilActivo(db, id);
    perfil.asistenciaObligatoria = valor;
  });
}

export async function resumenEliminarPerfil(id: string): Promise<string[]> {
  const db = leerDb();
  perfilPropio(db, id);
  const anios = db.anios.filter((a) => a.perfilId === id);
  const anioIds = new Set(anios.map((a) => a.id));
  const periodoIds = new Set(db.periodos.filter((p) => anioIds.has(p.anioLectivoId)).map((p) => p.id));
  const periodosFinalizados = new Set(
    db.cierres.filter((c) => periodoIds.has(c.periodoId)).map((c) => c.periodoId),
  ).size;
  const cursos = db.cursos.filter((c) => anioIds.has(c.anioLectivoId));
  const cursoIds = new Set(cursos.map((c) => c.id));
  const estudiantes = db.estudiantes.filter((e) => cursoIds.has(e.cursoId)).length;
  const notas = notasDelPerfil(db, id).length;

  const lineas = [lineaConteo(anios.length, 'año lectivo', 'años lectivos')];
  if (periodosFinalizados > 0) {
    lineas.push(lineaConteo(periodosFinalizados, 'periodo finalizado', 'periodos finalizados'));
  }
  if (cursos.length > 0) lineas.push(lineaConteo(cursos.length, 'curso', 'cursos'));
  if (estudiantes > 0) lineas.push(lineaConteo(estudiantes, 'estudiante', 'estudiantes'));
  if (notas > 0) lineas.push(lineaConteo(notas, 'nota', 'notas'));
  return lineas;
}

/**
 * Elimina el perfil con todos sus años, periodos, notas y cierres. Exige
 * propiedad (ErrorAcceso) pero no bloquea por periodos finalizados: la UI debe
 * mostrar antes `resumenEliminarPerfil` y pedir confirmación.
 */
export async function eliminarPerfil(id: string): Promise<void> {
  escribirDb((db) => {
    perfilPropio(db, id);
    borrarPerfil(db, id);
  });
}

export async function estadoReglas(id: string): Promise<{ conCierres: boolean; conNotas: boolean }> {
  const db = leerDb();
  perfilPropio(db, id);
  return {
    conCierres: perfilConCierres(db, id),
    conNotas: notasDelPerfil(db, id).length > 0,
  };
}
