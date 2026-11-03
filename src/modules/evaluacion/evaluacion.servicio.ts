import type {
  Actividad, AnioLectivo, BaseDatos, CierrePeriodo, Estudiante, Grupo, Nota, Perfil, Periodo, ValorNota,
} from '@/core/tipos';
import { GRUPOS } from '@/core/tipos';
import { ErrorAcceso, ErrorFinalizar, ErrorNegocio, ErrorValidacion } from '@/core/errores';
import type { DetalleFinalizar } from '@/core/errores';
import { escribirDb, leerDb } from '@/core/almacen';
import {
  actividadPropia, anioPropio, asignacionPropia, cursoPropio, estudiantePropio, periodoPropio, perfilPropio,
} from '@/core/acceso';
import {
  asegurarAnioEditable, asegurarAsignacionAbierta, motivoSoloLectura,
} from '@/core/bloqueos';
import { borrarActividad, lineaConteo } from '@/core/cascadas';
import { hoy } from '@/core/reloj';
import { nuevoId } from '@/core/ids';
import {
  detalleAsignacionDe, type AsignacionDetalle,
} from '@/modules/materias/materias.servicio';
import {
  numeroPeriodo, ordenarPeriodos, problemasConfiguracion,
} from '@/modules/periodos/validaciones';
import { aNumero, Fraccion } from './fraccion';
import {
  aprueba, calcularDefinitiva, calcularNotaPeriodo, nivelNacional, pesosDePeriodos,
} from './calculo';
import { parsearNota } from './notas';

export interface Planilla {
  perfil: Perfil;
  anio: AnioLectivo;
  asignacion: AsignacionDetalle;
  periodos: Periodo[];
  periodo: Periodo;
  numeroPeriodo: number;
  estudiantes: Estudiante[];
  actividades: Actividad[];
  notas: Nota[];
  cierre: CierrePeriodo | null;
  problemas: string[];
  gruposSinActividades: Grupo[];
  motivoSoloLectura: string | null;
}

export interface FilaDefinitiva {
  estudiante: Estudiante;
  notasPeriodo: (number | null)[];
  definitiva: number | null;
  nivel: string | null;
  aprueba: boolean | null;
}

export interface Definitivas {
  perfil: Perfil;
  anio: AnioLectivo;
  asignacion: AsignacionDetalle;
  periodos: Periodo[];
  /** Porcentaje de cada periodo, en el mismo orden que `periodos`. */
  pesos: number[];
  filas: FilaDefinitiva[];
}

interface Contexto {
  asig: { id: string };
  detalle: AsignacionDetalle;
  anio: AnioLectivo;
  perfil: Perfil;
  periodo: Periodo;
  periodos: Periodo[];
}

/** Resuelve asignación y periodo con aislamiento; el periodo debe pertenecer al año de la asignación. */
function resolver(db: BaseDatos, asignacionId: string, periodoId: string): Contexto {
  const asig = asignacionPropia(db, asignacionId);
  const curso = cursoPropio(db, asig.cursoId);
  const periodo = periodoPropio(db, periodoId);
  if (periodo.anioLectivoId !== curso.anioLectivoId) {
    throw new ErrorAcceso('El periodo no pertenece al año lectivo de esta materia.');
  }
  const anio = anioPropio(db, curso.anioLectivoId);
  const perfil = perfilPropio(db, anio.perfilId);
  const periodos = ordenarPeriodos(db.periodos.filter((p) => p.anioLectivoId === anio.id));
  return { asig, detalle: detalleAsignacionDe(db, asig), anio, perfil, periodo, periodos };
}

function ordenarActividades(actividades: Actividad[]): Actividad[] {
  return actividades
    .map((a, indice) => ({ a, indice, orden: GRUPOS.indexOf(a.grupo) }))
    .sort((x, y) => x.orden - y.orden || x.indice - y.indice)
    .map((x) => x.a);
}

function construirPlanilla(db: BaseDatos, ctx: Contexto): Planilla {
  const asignacionId = ctx.asig.id;
  const periodoId = ctx.periodo.id;
  const estudiantes = db.estudiantes
    .filter((e) => e.cursoId === ctx.detalle.curso.id)
    .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es') || a.nombres.localeCompare(b.nombres, 'es'));
  const actividades = ordenarActividades(
    db.actividades.filter((a) => a.asignacionId === asignacionId && a.periodoId === periodoId),
  );
  const actIds = new Set(actividades.map((a) => a.id));
  const notas = db.notas.filter((n) => actIds.has(n.actividadId));
  const cierre = db.cierres.find((c) => c.asignacionId === asignacionId && c.periodoId === periodoId) ?? null;
  const motivo = motivoSoloLectura(ctx.perfil, ctx.anio)
    ?? (cierre ? 'Periodo finalizado para esta materia: solo consulta' : null);

  return {
    perfil: ctx.perfil,
    anio: ctx.anio,
    asignacion: ctx.detalle,
    periodos: ctx.periodos,
    periodo: ctx.periodo,
    numeroPeriodo: numeroPeriodo(periodoId, ctx.periodos),
    estudiantes,
    actividades,
    notas,
    cierre,
    problemas: problemasConfiguracion(ctx.anio, ctx.periodos, periodoId),
    gruposSinActividades: GRUPOS.filter((g) => !actividades.some((a) => a.grupo === g)),
    motivoSoloLectura: motivo,
  };
}

function nombreCompleto(e: Estudiante): string {
  return `${e.apellidos} ${e.nombres}`;
}

export async function obtenerPlanilla(asignacionId: string, periodoId: string): Promise<Planilla> {
  const db = leerDb();
  return construirPlanilla(db, resolver(db, asignacionId, periodoId));
}

function validarActividad(datos: { nombre: string; grupo: Grupo }): { nombre: string } {
  const nombre = datos.nombre.trim();
  const errores: Record<string, string> = {};
  if (nombre === '') errores.nombre = 'Escribe el nombre de la actividad.';
  if (!GRUPOS.includes(datos.grupo)) errores.grupo = 'Elige Ser, Saber o Hacer.';
  if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);
  return { nombre };
}

export async function crearActividad(
  asignacionId: string,
  periodoId: string,
  datos: { nombre: string; grupo: Grupo },
): Promise<Actividad> {
  const limpia = validarActividad(datos);
  const salida: { actividad?: Actividad } = {};
  escribirDb((db) => {
    const ctx = resolver(db, asignacionId, periodoId);
    asegurarAnioEditable(db, ctx.anio.id);
    asegurarAsignacionAbierta(db, asignacionId, periodoId);
    const actividad: Actividad = {
      id: nuevoId(), asignacionId, periodoId, nombre: limpia.nombre, grupo: datos.grupo,
    };
    db.actividades.push(actividad);
    salida.actividad = actividad;
  });
  if (!salida.actividad) throw new ErrorNegocio('No se pudo crear la actividad.');
  return salida.actividad;
}

export async function actualizarActividad(id: string, datos: { nombre: string; grupo: Grupo }): Promise<void> {
  const limpia = validarActividad(datos);
  escribirDb((db) => {
    const actividad = actividadPropia(db, id);
    const ctx = resolver(db, actividad.asignacionId, actividad.periodoId);
    asegurarAnioEditable(db, ctx.anio.id);
    asegurarAsignacionAbierta(db, actividad.asignacionId, actividad.periodoId);
    actividad.nombre = limpia.nombre;
    actividad.grupo = datos.grupo;
  });
}

export async function resumenEliminarActividad(id: string): Promise<string[]> {
  const db = leerDb();
  actividadPropia(db, id);
  const notas = db.notas.filter((n) => n.actividadId === id).length;
  const lineas = [lineaConteo(1, 'actividad', 'actividades')];
  if (notas > 0) lineas.push(lineaConteo(notas, 'nota se borrará', 'notas se borrarán'));
  return lineas;
}

export async function eliminarActividad(id: string): Promise<void> {
  escribirDb((db) => {
    const actividad = actividadPropia(db, id);
    const ctx = resolver(db, actividad.asignacionId, actividad.periodoId);
    asegurarAnioEditable(db, ctx.anio.id);
    asegurarAsignacionAbierta(db, actividad.asignacionId, actividad.periodoId);
    borrarActividad(db, id);
  });
}

/** Texto vacío borra la nota ("sin nota", nunca cero). */
export async function guardarNota(actividadId: string, estudianteId: string, texto: string): Promise<Nota | null> {
  const salida: { nota: Nota | null } = { nota: null };
  escribirDb((db) => {
    const actividad = actividadPropia(db, actividadId);
    const ctx = resolver(db, actividad.asignacionId, actividad.periodoId);
    const estudiante = estudiantePropio(db, estudianteId);
    if (estudiante.cursoId !== ctx.detalle.curso.id) {
      throw new ErrorNegocio('Este estudiante no pertenece al curso de esta materia.');
    }
    asegurarAnioEditable(db, ctx.anio.id);
    asegurarAsignacionAbierta(db, actividad.asignacionId, actividad.periodoId);

    const problemas = problemasConfiguracion(ctx.anio, ctx.periodos, actividad.periodoId);
    if (problemas.length > 0) {
      throw new ErrorNegocio(`No se pueden registrar notas todavía. ${problemas.join(' ')}`);
    }

    const parseo = parsearNota(texto, ctx.perfil.escala);
    if (!parseo.ok) throw new ErrorValidacion({ nota: parseo.error });

    const indice = db.notas.findIndex((n) => n.actividadId === actividadId && n.estudianteId === estudianteId);
    if (parseo.valor === null) {
      if (indice >= 0) db.notas.splice(indice, 1);
      salida.nota = null;
      return;
    }
    if (indice >= 0) {
      db.notas[indice].valor = parseo.valor;
      salida.nota = { ...db.notas[indice] };
    } else {
      const nota: Nota = { actividadId, estudianteId, valor: parseo.valor };
      db.notas.push(nota);
      salida.nota = { ...nota };
    }
  });
  return salida.nota;
}

/** Calcula y congela las notas del periodo para la asignación. Acumula todos los motivos que impiden hacerlo. */
export async function finalizarPeriodo(asignacionId: string, periodoId: string): Promise<void> {
  escribirDb((db) => {
    const ctx = resolver(db, asignacionId, periodoId);
    asegurarAnioEditable(db, ctx.anio.id);
    asegurarAsignacionAbierta(db, asignacionId, periodoId);
    const planilla = construirPlanilla(db, ctx);

    const pendientes: DetalleFinalizar['pendientes'] = [];
    for (const estudiante of planilla.estudiantes) {
      for (const actividad of planilla.actividades) {
        const tiene = planilla.notas.some((n) => n.actividadId === actividad.id && n.estudianteId === estudiante.id);
        if (!tiene) pendientes.push({ estudiante: nombreCompleto(estudiante), actividad: actividad.nombre });
      }
    }

    const detalle: DetalleFinalizar = {
      gruposSinActividades: planilla.gruposSinActividades,
      pendientes,
      configuracion: planilla.problemas,
    };
    if (hoy() < ctx.periodo.fechaFin) detalle.antesDeFecha = ctx.periodo.fechaFin;
    if (planilla.estudiantes.length === 0) detalle.sinEstudiantes = true;

    const hayMotivos = detalle.antesDeFecha !== undefined
      || detalle.gruposSinActividades.length > 0
      || pendientes.length > 0
      || detalle.configuracion.length > 0
      || detalle.sinEstudiantes === true;
    if (hayMotivos) throw new ErrorFinalizar(detalle);

    const pct = ctx.anio.modoGrupos === 'varian' ? ctx.periodo.grupos : ctx.anio.gruposIguales;
    if (!pct) throw new ErrorNegocio('Faltan los porcentajes de Ser, Saber y Hacer del periodo.');

    const notasCalculadas: Record<string, number> = {};
    for (const estudiante of planilla.estudiantes) {
      const porGrupo: Record<Grupo, ValorNota[]> = { ser: [], saber: [], hacer: [] };
      for (const actividad of planilla.actividades) {
        const nota = planilla.notas.find((n) => n.actividadId === actividad.id && n.estudianteId === estudiante.id);
        if (nota) porGrupo[actividad.grupo].push(nota.valor);
      }
      notasCalculadas[estudiante.id] = calcularNotaPeriodo(porGrupo, pct, ctx.perfil.escala);
    }

    db.cierres.push({ asignacionId, periodoId, fecha: hoy(), notasCalculadas });
  });
}

export async function obtenerDefinitivas(asignacionId: string): Promise<Definitivas> {
  const db = leerDb();
  const asig = asignacionPropia(db, asignacionId);
  const curso = cursoPropio(db, asig.cursoId);
  const anio = anioPropio(db, curso.anioLectivoId);
  const perfil = perfilPropio(db, anio.perfilId);
  const periodos = ordenarPeriodos(db.periodos.filter((p) => p.anioLectivoId === anio.id));
  const pesos = pesosDePeriodos(anio, periodos);
  const estudiantes = db.estudiantes
    .filter((e) => e.cursoId === curso.id)
    .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es') || a.nombres.localeCompare(b.nombres, 'es'));

  const filas: FilaDefinitiva[] = estudiantes.map((estudiante) => {
    const notasPeriodo: (number | null)[] = periodos.map((p) => {
      const cierre = db.cierres.find((c) => c.asignacionId === asignacionId && c.periodoId === p.id);
      return cierre?.notasCalculadas[estudiante.id] ?? null;
    });

    const completa = periodos.length > 0 && notasPeriodo.every((v) => v !== null);
    let definitiva: number | null = null;
    if (completa) {
      const items: { nota: number; peso: Fraccion }[] = [];
      periodos.forEach((p, i) => {
        const nota = notasPeriodo[i];
        if (nota !== null) items.push({ nota, peso: pesos[p.id] });
      });
      definitiva = calcularDefinitiva(items, perfil.escala);
    }

    return {
      estudiante,
      notasPeriodo,
      definitiva,
      nivel: definitiva === null ? null : nivelNacional(definitiva, perfil.nivelesNacionales),
      aprueba: definitiva === null ? null : aprueba(definitiva, perfil),
    };
  });

  return {
    perfil,
    anio,
    asignacion: detalleAsignacionDe(db, asig),
    periodos,
    pesos: periodos.map((p) => aNumero(pesos[p.id])),
    filas,
  };
}
