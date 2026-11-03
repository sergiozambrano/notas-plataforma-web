import type { Periodo } from '@/core/tipos';
import { ErrorNegocio, ErrorValidacion } from '@/core/errores';
import { escribirDb, leerDb } from '@/core/almacen';
import { anioPropio, periodoPropio } from '@/core/acceso';
import {
  asegurarAnioEditable, asegurarEstructuraPeriodos, asegurarPeriodoSinCierre,
} from '@/core/bloqueos';
import { borrarPeriodo, lineaConteo } from '@/core/cascadas';
import { nuevoId } from '@/core/ids';
import {
  cruces, numeroPeriodo, ordenarPeriodos, problemasConfiguracion, validarRangoFechas,
} from './validaciones';

export interface DatosPeriodo {
  fechaInicio: string;
  fechaFin: string;
}

function asegurarFechas(datos: DatosPeriodo): void {
  const errores = validarRangoFechas(datos.fechaInicio, datos.fechaFin);
  if (errores) throw new ErrorValidacion(errores);
}

function textoPeriodos(ids: string[], periodos: Periodo[]): string {
  return ids.map((id) => `Periodo ${numeroPeriodo(id, periodos)}`).join(' y ');
}

export async function listarPeriodos(anioId: string): Promise<Periodo[]> {
  const db = leerDb();
  anioPropio(db, anioId);
  return ordenarPeriodos(db.periodos.filter((p) => p.anioLectivoId === anioId));
}

export async function crearPeriodo(anioId: string, datos: DatosPeriodo): Promise<Periodo> {
  const salida: { periodo?: Periodo } = {};
  escribirDb((db) => {
    anioPropio(db, anioId);
    asegurarAnioEditable(db, anioId);
    asegurarEstructuraPeriodos(db, anioId);
    asegurarFechas(datos);

    const existentes = db.periodos.filter((p) => p.anioLectivoId === anioId);
    const cruzados = cruces({ fechaInicio: datos.fechaInicio, fechaFin: datos.fechaFin }, existentes);
    if (cruzados.length > 0) {
      throw new ErrorNegocio(`El periodo se cruza con ${textoPeriodos(cruzados.map((p) => p.id), existentes)}.`);
    }

    const periodo: Periodo = {
      id: nuevoId(),
      anioLectivoId: anioId,
      fechaInicio: datos.fechaInicio,
      fechaFin: datos.fechaFin,
    };
    db.periodos.push(periodo);
    salida.periodo = periodo;
  });
  if (!salida.periodo) throw new ErrorNegocio('No se pudo crear el periodo.');
  return salida.periodo;
}

export async function actualizarPeriodo(id: string, datos: DatosPeriodo): Promise<void> {
  escribirDb((db) => {
    const periodo = periodoPropio(db, id);
    asegurarAnioEditable(db, periodo.anioLectivoId);
    asegurarPeriodoSinCierre(db, id);
    asegurarFechas(datos);

    const existentes = db.periodos.filter((p) => p.anioLectivoId === periodo.anioLectivoId);
    const cruzados = cruces(
      { id, fechaInicio: datos.fechaInicio, fechaFin: datos.fechaFin },
      existentes,
    );
    if (cruzados.length > 0) {
      throw new ErrorNegocio(`El periodo se cruza con ${textoPeriodos(cruzados.map((p) => p.id), existentes)}.`);
    }

    periodo.fechaInicio = datos.fechaInicio;
    periodo.fechaFin = datos.fechaFin;
  });
}

export async function resumenEliminarPeriodo(id: string): Promise<string[]> {
  const db = leerDb();
  periodoPropio(db, id);
  const actividades = db.actividades.filter((a) => a.periodoId === id);
  const actIds = new Set(actividades.map((a) => a.id));
  const notas = db.notas.filter((n) => actIds.has(n.actividadId)).length;
  const cierres = db.cierres.filter((c) => c.periodoId === id).length;

  const lineas = [lineaConteo(1, 'periodo', 'periodos')];
  if (actividades.length > 0) lineas.push(lineaConteo(actividades.length, 'actividad', 'actividades'));
  if (notas > 0) lineas.push(lineaConteo(notas, 'nota', 'notas'));
  if (cierres > 0) lineas.push(lineaConteo(cierres, 'cierre de notas', 'cierres de notas'));
  return lineas;
}

export async function eliminarPeriodo(id: string): Promise<void> {
  escribirDb((db) => {
    const periodo = periodoPropio(db, id);
    asegurarAnioEditable(db, periodo.anioLectivoId);
    asegurarPeriodoSinCierre(db, id);
    asegurarEstructuraPeriodos(db, periodo.anioLectivoId);
    borrarPeriodo(db, id);
  });
}

export async function periodosConCierre(anioId: string): Promise<string[]> {
  const db = leerDb();
  anioPropio(db, anioId);
  const conCierre = new Set(db.cierres.map((c) => c.periodoId));
  return db.periodos
    .filter((p) => p.anioLectivoId === anioId && conCierre.has(p.id))
    .map((p) => p.id);
}

export async function problemasDelAnio(anioId: string): Promise<string[]> {
  const db = leerDb();
  const anio = anioPropio(db, anioId);
  const periodos = db.periodos.filter((p) => p.anioLectivoId === anioId);
  return problemasConfiguracion(anio, periodos);
}
