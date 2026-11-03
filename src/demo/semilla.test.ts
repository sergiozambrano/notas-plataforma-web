import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { instalarLocalStorageFalso } from '@/core/pruebas/localStorageFalso';
import { anioActual, fijarReloj } from '@/core/reloj';
import { leerDb } from '@/core/almacen';
import type { AnioLectivo, BaseDatos, Perfil } from '@/core/tipos';
import { ErrorAcceso, ErrorFinalizar } from '@/core/errores';
import { perfilConCierres } from '@/core/bloqueos';
import { ordenarPeriodos, problemasConfiguracion } from '@/modules/periodos/validaciones';
import * as auth from '@/modules/auth/auth.servicio';
import * as perfiles from '@/modules/perfiles/perfiles.servicio';
import * as evaluacion from '@/modules/evaluacion/evaluacion.servicio';
import { cargarDemo, CONTRASENA_DEMO, CORREO_DEMO, CORREO_DEMO_2 } from './semilla';

function encontrar<T>(lista: T[], predicado: (t: T) => boolean, descripcion: string): T {
  const hallado = lista.find(predicado);
  if (!hallado) throw new Error(`No está en la demo: ${descripcion}`);
  return hallado;
}

function perfilDemo(db: BaseDatos, nombre: string): Perfil {
  return encontrar(db.perfiles, (p) => p.nombre === nombre, nombre);
}

function anioDemo(db: BaseDatos, perfil: Perfil, anio: number): AnioLectivo {
  return encontrar(db.anios, (a) => a.perfilId === perfil.id && a.anio === anio, `año ${anio}`);
}

/** Asignación de un curso (grado + grupo) y una materia dentro del año actual del Perfil A. */
function asignacionNovenoMatematicas(db: BaseDatos, grupo: string): string {
  const perfil = perfilDemo(db, 'Colegio San José');
  const anio = anioDemo(db, perfil, anioActual());
  const curso = encontrar(
    db.cursos,
    (c) => c.anioLectivoId === anio.id && c.grado === '9.°' && c.grupo === grupo,
    `9.° ${grupo}`,
  );
  const materia = encontrar(
    db.materias,
    (m) => m.anioLectivoId === anio.id && m.nombre === 'Matemáticas',
    'Matemáticas',
  );
  return encontrar(
    db.asignaciones,
    (a) => a.cursoId === curso.id && a.materiaId === materia.id,
    `Matemáticas ${grupo}`,
  ).id;
}

async function errorDe<T extends Error>(promesa: Promise<unknown>): Promise<T> {
  try {
    await promesa;
  } catch (e) {
    return e as T;
  }
  throw new Error('Se esperaba un error y no lo hubo');
}

describe('datos de demostración', () => {
  beforeEach(async () => {
    instalarLocalStorageFalso();
    // Noviembre del año actual: todos los periodos de la demo ya terminaron, salvo el último de Perfil B.
    fijarReloj(new Date(anioActual(), 10, 15, 12, 0, 0));
    await cargarDemo();
  });

  afterEach(() => {
    fijarReloj(null);
  });

  it('tiene los conteos de la sección 8', () => {
    const db = leerDb();
    expect(db.usuarios).toHaveLength(2);
    expect(db.perfiles).toHaveLength(3);
    expect(db.anios).toHaveLength(4);
    expect(db.periodos).toHaveLength(10);
    expect(db.eventos).toHaveLength(2);
    expect(db.cursos).toHaveLength(6);
    expect(db.materias).toHaveLength(9);
    expect(db.asignaciones).toHaveLength(11);
    expect(db.estudiantes).toHaveLength(28);
    expect(db.cierres).toHaveLength(6);
  });

  it('la cuenta 1 tiene Perfil A con 9.° A, 9.° B y 10.° A de 6 estudiantes cada uno', () => {
    const db = leerDb();
    const perfilA = perfilDemo(db, 'Colegio San José');
    const anio = anioDemo(db, perfilA, anioActual());
    const cursos = db.cursos.filter((c) => c.anioLectivoId === anio.id);
    expect(cursos.map((c) => `${c.grado} ${c.grupo}`).sort()).toEqual(['10.° A', '9.° A', '9.° B']);
    for (const curso of cursos) {
      expect(db.estudiantes.filter((e) => e.cursoId === curso.id)).toHaveLength(6);
    }
  });

  it('el año anterior del Perfil A tiene 2 periodos finalizados, 3 estudiantes y 1 asignación', () => {
    const db = leerDb();
    const perfilA = perfilDemo(db, 'Colegio San José');
    const anterior = anioDemo(db, perfilA, anioActual() - 1);
    const periodos = db.periodos.filter((p) => p.anioLectivoId === anterior.id);
    expect(periodos).toHaveLength(2);
    expect(db.cursos.filter((c) => c.anioLectivoId === anterior.id)).toHaveLength(1);
    expect(db.materias.filter((m) => m.anioLectivoId === anterior.id)).toHaveLength(1);
    const asignaciones = db.asignaciones.filter((a) => db.cursos.some((c) => c.id === a.cursoId && c.anioLectivoId === anterior.id));
    expect(asignaciones).toHaveLength(1);
    const estudiantes = db.estudiantes.filter((e) => e.cursoId === db.cursos.find((c) => c.anioLectivoId === anterior.id)?.id);
    expect(estudiantes).toHaveLength(3);
    for (const periodo of periodos) {
      expect(db.cierres.some((c) => c.periodoId === periodo.id)).toBe(true);
    }
  });

  it('9.° A tiene 3 periodos finalizados y, en la definitiva, al menos un Aprueba y un No aprueba', async () => {
    expect(await auth.iniciarSesion(CORREO_DEMO, CONTRASENA_DEMO)).toEqual({ ok: true });
    const asignacionId = asignacionNovenoMatematicas(leerDb(), 'A');
    const cierres = leerDb().cierres.filter((c) => c.asignacionId === asignacionId);
    expect(cierres).toHaveLength(3);

    const definitivas = await evaluacion.obtenerDefinitivas(asignacionId);
    expect(definitivas.filas.some((f) => f.aprueba === true)).toBe(true);
    expect(definitivas.filas.some((f) => f.aprueba === false)).toBe(true);
    expect(definitivas.filas.every((f) => f.definitiva !== null)).toBe(true);
  });

  it('9.° B: finalizar el periodo 2 funciona y el periodo 3 lista pendientes', async () => {
    expect(await auth.iniciarSesion(CORREO_DEMO, CONTRASENA_DEMO)).toEqual({ ok: true });
    const db = leerDb();
    const asignacionId = asignacionNovenoMatematicas(db, 'B');
    const perfil = perfilDemo(db, 'Colegio San José');
    const periodos = ordenarPeriodos(db.periodos.filter((p) => p.anioLectivoId === anioDemo(db, perfil, anioActual()).id));
    const [p1, p2, p3] = periodos;

    expect(db.cierres.some((c) => c.asignacionId === asignacionId && c.periodoId === p1.id)).toBe(true);
    await evaluacion.finalizarPeriodo(asignacionId, p2.id);
    expect(leerDb().cierres.some((c) => c.asignacionId === asignacionId && c.periodoId === p2.id)).toBe(true);

    const error = await errorDe<ErrorFinalizar>(evaluacion.finalizarPeriodo(asignacionId, p3.id));
    expect(error).toBeInstanceOf(ErrorFinalizar);
    expect(error.detalle.pendientes.length).toBeGreaterThan(0);
  });

  it('Perfil B no tiene cierres y su configuración no tiene problemas', async () => {
    expect(await auth.iniciarSesion(CORREO_DEMO, CONTRASENA_DEMO)).toEqual({ ok: true });
    const db = leerDb();
    const perfil = perfilDemo(db, 'Escuela Rural La Esperanza');
    const anio = anioDemo(db, perfil, anioActual());
    const periodos = db.periodos.filter((p) => p.anioLectivoId === anio.id);

    expect(perfilConCierres(db, perfil.id)).toBe(false);
    expect(problemasConfiguracion(anio, periodos)).toEqual([]);
    expect(await perfiles.estadoReglas(perfil.id)).toEqual({ conCierres: false, conNotas: true });
  });

  it('docente2 no puede ver ni abrir datos de la demo del docente 1', async () => {
    expect(await auth.iniciarSesion(CORREO_DEMO_2, CONTRASENA_DEMO)).toEqual({ ok: true });
    const db = leerDb();
    const perfilA = perfilDemo(db, 'Colegio San José');
    const asignacionId = asignacionNovenoMatematicas(db, 'A');

    expect(await errorDe(perfiles.obtenerPerfil(perfilA.id))).toBeInstanceOf(ErrorAcceso);
    expect(await errorDe(evaluacion.obtenerDefinitivas(asignacionId))).toBeInstanceOf(ErrorAcceso);
    const propios = await perfiles.listarPerfiles();
    expect(propios.map((p) => p.nombre)).toEqual(['Colegio Nuevo Horizonte']);
  });
});
