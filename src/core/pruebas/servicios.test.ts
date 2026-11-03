import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { instalarLocalStorageFalso } from './localStorageFalso';
import { fijarReloj } from '@/core/reloj';
import { leerDb } from '@/core/almacen';
import { ErrorAcceso, ErrorAdvertencia, ErrorFinalizar, ErrorNegocio, ErrorSesion, ErrorValidacion } from '@/core/errores';
import * as auth from '@/modules/auth/auth.servicio';
import * as perfiles from '@/modules/perfiles/perfiles.servicio';
import * as anios from '@/modules/anios/anios.servicio';
import * as periodos from '@/modules/periodos/periodos.servicio';
import * as cursos from '@/modules/cursos/cursos.servicio';
import * as materias from '@/modules/materias/materias.servicio';
import * as estudiantes from '@/modules/estudiantes/estudiantes.servicio';
import * as calendario from '@/modules/calendario/calendario.servicio';
import * as evaluacion from '@/modules/evaluacion/evaluacion.servicio';
import { cerrarSesion } from '@/modules/auth/auth.servicio';

const CORREO = 'docente@colegio.co';
const CONTRASENA = 'Clave12345';

/** Espera un rechazo y lo devuelve para inspeccionarlo. */
async function errorDe<T extends Error>(promesa: Promise<unknown>): Promise<T> {
  try {
    await promesa;
  } catch (e) {
    return e as T;
  }
  throw new Error('Se esperaba un error y no lo hubo');
}

async function registrarEntrar(correo: string, contrasena = CONTRASENA): Promise<void> {
  await auth.registrar({ nombreCompleto: 'Docente de prueba', correo, contrasena });
  expect(await auth.iniciarSesion(correo, contrasena)).toEqual({ ok: true });
}

/** Perfil con año, curso, materia y asignación. Requiere sesión. */
async function prepararCurso() {
  const perfil = await perfiles.crearPerfil('Colegio San José');
  const [anio] = await anios.listarAnios(perfil.id);
  const curso = await cursos.crearCurso(anio.id, { grado: 'Noveno', grupo: 'A' });
  const materia = await materias.crearMateria(anio.id, { nombre: 'Matemáticas' });
  const asig = await materias.crearAsignacion(curso.id, materia.id);
  await anios.guardarConfiguracion(anio.id, {
    modoPesoPeriodos: 'iguales',
    modoGrupos: 'iguales',
    gruposIguales: { ser: 20, saber: 50, hacer: 30 },
    periodos: [],
  });
  return { perfil, anio, curso, materia, asig };
}

/**
 * Dos periodos ya terminados (reloj en junio) con un estudiante y una actividad
 * por grupo, todas con nota 4,0. Requiere sesión.
 */
async function prepararFinalizable() {
  const base = await prepararCurso();
  const p1 = await periodos.crearPeriodo(base.anio.id, { fechaInicio: '2026-02-01', fechaFin: '2026-03-31' });
  const p2 = await periodos.crearPeriodo(base.anio.id, { fechaInicio: '2026-04-01', fechaFin: '2026-05-31' });
  const est = await estudiantes.crearEstudiante(base.curso.id, { nombres: 'Ana', apellidos: 'Pérez' });
  for (const periodo of [p1, p2]) {
    for (const grupo of ['ser', 'saber', 'hacer'] as const) {
      const act = await evaluacion.crearActividad(base.asig.id, periodo.id, { nombre: `Act ${grupo}`, grupo });
      await evaluacion.guardarNota(act.id, est.id, '4,0');
    }
  }
  return { ...base, p1, p2, est };
}

describe('localStorage falso, reloj y sesión', () => {
  beforeEach(() => {
    instalarLocalStorageFalso();
    fijarReloj(new Date(2026, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    fijarReloj(null);
  });

  it('sin sesión los servicios internos lanzan ErrorSesion', async () => {
    expect(await errorDe(perfiles.listarPerfiles())).toBeInstanceOf(ErrorSesion);
  });
});

describe('HU-02 bloqueo al tercer fallo y desbloqueo por recuperación', () => {
  beforeEach(() => {
    instalarLocalStorageFalso();
    fijarReloj(new Date(2026, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    fijarReloj(null);
  });

  it('bloquea al tercer fallo y se desbloquea con el restablecimiento', async () => {
    await auth.registrar({ nombreCompleto: 'Docente', correo: CORREO, contrasena: CONTRASENA });

    expect(await auth.iniciarSesion(CORREO, 'mal-1234')).toEqual({ ok: false, tipo: 'credenciales', intentosRestantes: 2 });
    expect(await auth.iniciarSesion(CORREO, 'mal-1234')).toEqual({ ok: false, tipo: 'credenciales', intentosRestantes: 1 });
    expect(await auth.iniciarSesion(CORREO, 'mal-1234')).toEqual({ ok: false, tipo: 'bloqueada' });
    // Bloqueada: ni con la contraseña correcta entra.
    expect(await auth.iniciarSesion(CORREO, CONTRASENA)).toEqual({ ok: false, tipo: 'bloqueada' });

    await auth.solicitarRecuperacion(CORREO);
    const [correo] = await auth.listarCorreos();
    const token = correo.enlace.split('token=')[1];
    await auth.restablecerContrasena(token, 'NuevaClave99');

    expect(await auth.iniciarSesion(CORREO, 'NuevaClave99')).toEqual({ ok: true });
  });

  it('un ingreso correcto tras 1 o 2 fallos reinicia el conteo', async () => {
    await auth.registrar({ nombreCompleto: 'Docente', correo: CORREO, contrasena: CONTRASENA });
    await auth.iniciarSesion(CORREO, 'mal-1234');
    await auth.iniciarSesion(CORREO, 'mal-1234');
    expect(await auth.iniciarSesion(CORREO, CONTRASENA)).toEqual({ ok: true });
    await auth.cerrarSesion();

    expect(await auth.iniciarSesion(CORREO, 'mal-1234')).toEqual({ ok: false, tipo: 'credenciales', intentosRestantes: 2 });
  });

  it('un correo desconocido responde igual que una cuenta real', async () => {
    await auth.registrar({ nombreCompleto: 'Docente', correo: CORREO, contrasena: CONTRASENA });

    const real: unknown[] = [];
    const desconocido: unknown[] = [];
    for (let i = 0; i < 4; i++) {
      real.push(await auth.iniciarSesion(CORREO, 'mal-1234'));
      desconocido.push(await auth.iniciarSesion('nadie@colegio.co', 'mal-1234'));
    }
    expect(desconocido).toEqual(real);
    expect(real[2]).toEqual({ ok: false, tipo: 'bloqueada' });
  });

  it('solicitar recuperación con correo no registrado no genera ningún correo', async () => {
    await auth.solicitarRecuperacion('nadie@colegio.co');
    expect(await auth.listarCorreos()).toEqual([]);
  });

  it('un token vence a la hora y no sirve después de usarse', async () => {
    await auth.registrar({ nombreCompleto: 'Docente', correo: CORREO, contrasena: CONTRASENA });
    await auth.solicitarRecuperacion(CORREO);
    const [correo] = await auth.listarCorreos();
    const token = correo.enlace.split('token=')[1];
    expect(correo.enlace).toContain('/restablecer?token=');

    fijarReloj(new Date(2026, 5, 15, 12, 59, 59));
    expect(await auth.validarToken(token)).toBe(true);

    fijarReloj(new Date(2026, 5, 15, 13, 0, 0));
    expect(await auth.validarToken(token)).toBe(false);
    expect(await errorDe(auth.restablecerContrasena(token, 'OtraClave123'))).toBeInstanceOf(ErrorNegocio);

    fijarReloj(new Date(2026, 5, 15, 12, 10, 0));
    await auth.solicitarRecuperacion(CORREO);
    const [, nuevo] = await auth.listarCorreos();
    const tokenNuevo = nuevo.enlace.split('token=')[1];
    await auth.restablecerContrasena(tokenNuevo, 'OtraClave123');
    expect(await auth.validarToken(tokenNuevo)).toBe(false);
    expect(await errorDe(auth.restablecerContrasena(tokenNuevo, 'OtraClave456'))).toBeInstanceOf(ErrorNegocio);
  });
});

describe('HU-21 aislamiento entre docentes', () => {
  beforeEach(() => {
    instalarLocalStorageFalso();
    fijarReloj(new Date(2026, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    fijarReloj(null);
  });

  it('el docente B no puede leer perfil, curso ni planilla del docente A', async () => {
    await registrarEntrar('a@colegio.co');
    const base = await prepararCurso();
    const periodo = await periodos.crearPeriodo(base.anio.id, { fechaInicio: '2026-02-01', fechaFin: '2026-03-31' });
    await cerrarSesion();

    await registrarEntrar('b@colegio.co');
    expect(await perfiles.listarPerfiles()).toEqual([]);
    expect(await errorDe(perfiles.obtenerPerfil(base.perfil.id))).toBeInstanceOf(ErrorAcceso);
    expect(await errorDe(cursos.obtenerCurso(base.curso.id))).toBeInstanceOf(ErrorAcceso);
    expect(await errorDe(estudiantes.listarEstudiantes(base.curso.id))).toBeInstanceOf(ErrorAcceso);
    expect(await errorDe(evaluacion.obtenerPlanilla(base.asig.id, periodo.id))).toBeInstanceOf(ErrorAcceso);
    expect(await errorDe(anios.listarAnios(base.perfil.id))).toBeInstanceOf(ErrorAcceso);
  });
});

describe('finalizarPeriodo acumula los motivos', () => {
  beforeEach(() => {
    instalarLocalStorageFalso();
    fijarReloj(new Date(2026, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    fijarReloj(null);
  });

  it('antes de la fecha, sin estudiantes, sin actividades y sin configuración: lista todos', async () => {
    await registrarEntrar(CORREO);
    const perfil = await perfiles.crearPerfil('Colegio');
    const [anio] = await anios.listarAnios(perfil.id);
    const curso = await cursos.crearCurso(anio.id, { grado: 'Sexto', grupo: 'B' });
    const materia = await materias.crearMateria(anio.id, { nombre: 'Ciencias' });
    const asig = await materias.crearAsignacion(curso.id, materia.id);
    const periodo = await periodos.crearPeriodo(anio.id, { fechaInicio: '2026-02-01', fechaFin: '2026-03-31' });

    fijarReloj(new Date(2026, 2, 10, 9, 0, 0));
    const error = await errorDe<ErrorFinalizar>(evaluacion.finalizarPeriodo(asig.id, periodo.id));
    expect(error).toBeInstanceOf(ErrorFinalizar);
    expect(error.detalle.antesDeFecha).toBe('2026-03-31');
    expect(error.detalle.gruposSinActividades).toEqual(['ser', 'saber', 'hacer']);
    expect(error.detalle.sinEstudiantes).toBe(true);
    expect(error.detalle.configuracion.length).toBeGreaterThan(0);
  });

  it('lista los pendientes de cada estudiante y actividad', async () => {
    await registrarEntrar(CORREO);
    const base = await prepararCurso();
    const periodo = await periodos.crearPeriodo(base.anio.id, { fechaInicio: '2026-02-01', fechaFin: '2026-03-31' });
    const est = await estudiantes.crearEstudiante(base.curso.id, { nombres: 'Luis', apellidos: 'Ruiz' });
    const actSer = await evaluacion.crearActividad(base.asig.id, periodo.id, { nombre: 'Quiz', grupo: 'ser' });
    await evaluacion.crearActividad(base.asig.id, periodo.id, { nombre: 'Taller', grupo: 'saber' });
    await evaluacion.crearActividad(base.asig.id, periodo.id, { nombre: 'Examen', grupo: 'hacer' });
    await evaluacion.guardarNota(actSer.id, est.id, '3,5');

    const error = await errorDe<ErrorFinalizar>(evaluacion.finalizarPeriodo(base.asig.id, periodo.id));
    expect(error).toBeInstanceOf(ErrorFinalizar);
    expect(error.detalle.antesDeFecha).toBeUndefined();
    expect(error.detalle.gruposSinActividades).toEqual([]);
    expect(error.detalle.pendientes).toEqual([
      { estudiante: 'Ruiz Luis', actividad: 'Taller' },
      { estudiante: 'Ruiz Luis', actividad: 'Examen' },
    ]);
  });
});

describe('definitivas y cálculo al finalizar', () => {
  beforeEach(() => {
    instalarLocalStorageFalso();
    fijarReloj(new Date(2026, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    fijarReloj(null);
  });

  it('pendiente hasta finalizar todos los periodos; luego calcula la definitiva', async () => {
    await registrarEntrar(CORREO);
    const base = await prepararFinalizable();

    await evaluacion.finalizarPeriodo(base.asig.id, base.p1.id);
    let defs = await evaluacion.obtenerDefinitivas(base.asig.id);
    expect(defs.filas[0].definitiva).toBeNull();
    expect(defs.filas[0].aprueba).toBeNull();

    await evaluacion.finalizarPeriodo(base.asig.id, base.p2.id);
    defs = await evaluacion.obtenerDefinitivas(base.asig.id);
    expect(defs.filas[0].notasPeriodo).toEqual([4, 4]);
    expect(defs.filas[0].definitiva).toBe(4);
    expect(defs.filas[0].nivel).toBe('Alto');
    expect(defs.filas[0].aprueba).toBe(true);
  });

  it('guardarNota: 6,0 se rechaza, y el texto vacío borra la nota (sin nota, nunca cero)', async () => {
    await registrarEntrar(CORREO);
    const base = await prepararCurso();
    await perfiles.guardarEscala(base.perfil.id, { tipo: 'numerica', notaMin: 0, notaMax: 5, decimales: 1 });
    const periodo = await periodos.crearPeriodo(base.anio.id, { fechaInicio: '2026-02-01', fechaFin: '2026-03-31' });
    const est = await estudiantes.crearEstudiante(base.curso.id, { nombres: 'Eva', apellidos: 'Gil' });
    const act = await evaluacion.crearActividad(base.asig.id, periodo.id, { nombre: 'Quiz', grupo: 'ser' });

    expect(await errorDe(evaluacion.guardarNota(act.id, est.id, '6,0'))).toBeInstanceOf(ErrorValidacion);
    expect(await evaluacion.guardarNota(act.id, est.id, '4,5')).toEqual({ actividadId: act.id, estudianteId: est.id, valor: 4.5 });
    expect(await evaluacion.guardarNota(act.id, est.id, '')).toBeNull();
    const planilla = await evaluacion.obtenerPlanilla(base.asig.id, periodo.id);
    expect(planilla.notas).toEqual([]);
  });

  it('crear estudiante duplicado pide confirmación', async () => {
    await registrarEntrar(CORREO);
    const base = await prepararCurso();
    await estudiantes.crearEstudiante(base.curso.id, { nombres: 'Ana', apellidos: 'Pérez' });
    expect(await errorDe(estudiantes.crearEstudiante(base.curso.id, { nombres: 'ana', apellidos: 'PÉREZ' })))
      .toBeInstanceOf(ErrorAdvertencia);
    await estudiantes.crearEstudiante(base.curso.id, { nombres: 'ana', apellidos: 'PÉREZ' }, { confirmado: true });
    expect(await estudiantes.listarEstudiantes(base.curso.id)).toHaveLength(2);
  });
});

describe('bloqueos de la regla 9', () => {
  beforeEach(() => {
    instalarLocalStorageFalso();
    fijarReloj(new Date(2026, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    fijarReloj(null);
  });

  it('9a: con el periodo finalizado en la asignación no se editan notas ni actividades', async () => {
    await registrarEntrar(CORREO);
    const base = await prepararFinalizable();
    await evaluacion.finalizarPeriodo(base.asig.id, base.p1.id);

    const actividades = (await evaluacion.obtenerPlanilla(base.asig.id, base.p1.id)).actividades;
    expect(await errorDe(evaluacion.guardarNota(actividades[0].id, base.est.id, '3,0'))).toBeInstanceOf(ErrorNegocio);
    expect(await errorDe(evaluacion.crearActividad(base.asig.id, base.p1.id, { nombre: 'Extra', grupo: 'ser' })))
      .toBeInstanceOf(ErrorNegocio);
    expect(await errorDe(evaluacion.actualizarActividad(actividades[0].id, { nombre: 'Cambio', grupo: 'ser' })))
      .toBeInstanceOf(ErrorNegocio);
    expect(await errorDe(evaluacion.eliminarActividad(actividades[0].id))).toBeInstanceOf(ErrorNegocio);
    expect(await errorDe(evaluacion.finalizarPeriodo(base.asig.id, base.p1.id))).toBeInstanceOf(ErrorNegocio);

    const planilla = await evaluacion.obtenerPlanilla(base.asig.id, base.p1.id);
    expect(planilla.motivoSoloLectura).not.toBeNull();
  });

  it('9b: periodo finalizado en cualquier asignación no cambia fechas, se elimina ni cambia la estructura del año', async () => {
    await registrarEntrar(CORREO);
    const base = await prepararFinalizable();
    await evaluacion.finalizarPeriodo(base.asig.id, base.p1.id);

    expect(await errorDe(periodos.actualizarPeriodo(base.p1.id, { fechaInicio: '2026-02-02', fechaFin: '2026-03-31' })))
      .toBeInstanceOf(ErrorNegocio);
    expect(await errorDe(periodos.eliminarPeriodo(base.p1.id))).toBeInstanceOf(ErrorNegocio);
    expect(await errorDe(periodos.crearPeriodo(base.anio.id, { fechaInicio: '2026-09-01', fechaFin: '2026-10-01' })))
      .toBeInstanceOf(ErrorNegocio);
    expect(await errorDe(anios.guardarConfiguracion(base.anio.id, {
      modoPesoPeriodos: 'varian',
      modoGrupos: 'iguales',
      gruposIguales: { ser: 20, saber: 50, hacer: 30 },
      periodos: [{ id: base.p1.id, peso: 30 }, { id: base.p2.id, peso: 70 }],
    }))).toBeInstanceOf(ErrorNegocio);

    // Un periodo no finalizado del mismo año sí se puede editar.
    await periodos.actualizarPeriodo(base.p2.id, { fechaInicio: '2026-04-01', fechaFin: '2026-05-20' });
  });

  it('9c: con un periodo finalizado no cambian escala, nota para aprobar ni niveles', async () => {
    await registrarEntrar(CORREO);
    const base = await prepararFinalizable();
    await evaluacion.finalizarPeriodo(base.asig.id, base.p1.id);

    expect(await errorDe(perfiles.guardarEscala(base.perfil.id, { tipo: 'numerica', notaMin: 0, notaMax: 5, decimales: 1 })))
      .toBeInstanceOf(ErrorNegocio);
    expect(await errorDe(perfiles.guardarAprobacion(base.perfil.id, 3.5, { bajo: 0, basico: 3, alto: 4, superior: 4.6 })))
      .toBeInstanceOf(ErrorNegocio);
    expect(await perfiles.estadoReglas(base.perfil.id)).toEqual({ conCierres: true, conNotas: true });
  });

  it('9d: años anteriores y perfiles inactivos son solo consulta', async () => {
    await registrarEntrar(CORREO);
    const base = await prepararCurso();

    // Un año después, el año de 2026 ya es anterior.
    fijarReloj(new Date(2027, 0, 15, 12, 0, 0));
    expect(await errorDe(cursos.crearCurso(base.anio.id, { grado: 'Décimo', grupo: 'A' })))
      .toBeInstanceOf(ErrorNegocio);
    expect(await cursos.listarCursos(base.anio.id)).toHaveLength(1);

    fijarReloj(new Date(2026, 5, 15, 12, 0, 0));
    await perfiles.cambiarActivo(base.perfil.id, false);
    expect(await errorDe(perfiles.renombrarPerfil(base.perfil.id, 'Otro nombre')))
      .toBeInstanceOf(ErrorNegocio);
    expect(await errorDe(cursos.crearCurso(base.anio.id, { grado: 'Décimo', grupo: 'B' })))
      .toBeInstanceOf(ErrorNegocio);
    await perfiles.cambiarActivo(base.perfil.id, true);
    await cursos.crearCurso(base.anio.id, { grado: 'Décimo', grupo: 'B' });
  });
});

describe('calendario y materias (reglas básicas)', () => {
  beforeEach(() => {
    instalarLocalStorageFalso();
    fijarReloj(new Date(2026, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    fijarReloj(null);
  });

  it('una actividad dentro de vacaciones pide confirmación; las vacaciones no se cruzan', async () => {
    await registrarEntrar(CORREO);
    const base = await prepararCurso();
    await calendario.crearEvento(base.anio.id, {
      tipo: 'vacaciones', nombre: 'Mitad de año', fechaInicio: '2026-06-15', fechaFin: '2026-06-19',
    });
    expect(await errorDe(calendario.crearEvento(base.anio.id, {
      tipo: 'actividad', nombre: 'Feria', fechaInicio: '2026-06-16', fechaFin: '2026-06-16',
    }))).toBeInstanceOf(ErrorAdvertencia);
    expect(await errorDe(calendario.crearEvento(base.anio.id, {
      tipo: 'vacaciones', nombre: 'Otras', fechaInicio: '2026-06-19', fechaFin: '2026-06-25',
    }))).toBeInstanceOf(ErrorNegocio);
  });

  it('no se asigna dos veces la misma materia al mismo curso', async () => {
    await registrarEntrar(CORREO);
    const base = await prepararCurso();
    expect(await errorDe(materias.crearAsignacion(base.curso.id, base.materia.id))).toBeInstanceOf(ErrorNegocio);
  });
});

describe('HU-05.5 eliminar perfil con datos', () => {
  beforeEach(() => {
    instalarLocalStorageFalso();
    fijarReloj(new Date(2026, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    fijarReloj(null);
  });

  it('se puede eliminar aunque tenga periodos finalizados; exige propiedad y borra notas y cierres', async () => {
    await registrarEntrar(CORREO);
    const base = await prepararFinalizable();
    await evaluacion.finalizarPeriodo(base.asig.id, base.p1.id);

    expect(await perfiles.resumenEliminarPerfil(base.perfil.id)).toEqual([
      '1 año lectivo', '1 periodo finalizado', '1 curso', '1 estudiante', '6 notas',
    ]);

    // Otro docente no puede eliminar el perfil ajeno.
    await cerrarSesion();
    await registrarEntrar('otro@colegio.co');
    expect(await errorDe(perfiles.eliminarPerfil(base.perfil.id))).toBeInstanceOf(ErrorAcceso);
    await cerrarSesion();

    // El dueño sí puede, aunque haya periodos finalizados.
    expect(await auth.iniciarSesion(CORREO, CONTRASENA)).toEqual({ ok: true });
    await perfiles.eliminarPerfil(base.perfil.id);
    expect(await perfiles.listarPerfiles()).toEqual([]);
    expect(leerDb().perfiles).toEqual([]);
    expect(leerDb().cierres).toEqual([]);
    expect(leerDb().notas).toEqual([]);
    expect(leerDb().anios).toEqual([]);
  });
});
