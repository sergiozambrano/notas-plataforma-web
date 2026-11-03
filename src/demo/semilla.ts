import type {
  Actividad, AnioLectivo, BaseDatos, Estudiante, Grupo, Perfil, Periodo, PorcentajesGrupos, Usuario, ValorNota,
} from '@/core/tipos';
import { dbVacia, escribirDb } from '@/core/almacen';
import { anioActual } from '@/core/reloj';
import { nuevoId } from '@/core/ids';
import { hashContrasena } from '@/modules/auth/auth.servicio';
import { calcularNotaPeriodo } from '@/modules/evaluacion/calculo';

/** Credenciales de la demostración (prototipo). */
export const CORREO_DEMO = 'demo@gestionnotas.co';
export const CORREO_DEMO_2 = 'docente2@gestionnotas.co';
export const CONTRASENA_DEMO = 'Demo1234';

const SAL_DEMO = 'sal-demo-cuenta-1';
const SAL_DEMO_2 = 'sal-demo-cuenta-2';

/** Fecha yyyy-MM-dd. */
function fecha(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Redondea a 1 decimal y limita al rango 0–5 (solo para generar notas de ejemplo). */
function notaDecimal(valor: number): number {
  return Math.min(5, Math.max(0, Math.round(valor * 10) / 10));
}

function nuevoPeriodo(
  db: BaseDatos,
  anioLectivoId: string,
  fechaInicio: string,
  fechaFin: string,
  extra: { peso?: number; grupos?: PorcentajesGrupos } = {},
): Periodo {
  const periodo: Periodo = { id: nuevoId(), anioLectivoId, fechaInicio, fechaFin, ...extra };
  db.periodos.push(periodo);
  return periodo;
}

function nuevosEstudiantes(db: BaseDatos, cursoId: string, nombres: [string, string][]): Estudiante[] {
  return nombres.map(([nombre, apellido]) => {
    const estudiante: Estudiante = { id: nuevoId(), cursoId, nombres: nombre, apellidos: apellido };
    db.estudiantes.push(estudiante);
    return estudiante;
  });
}

function nuevasActividades(
  db: BaseDatos,
  asignacionId: string,
  periodoId: string,
  plantilla: [string, Grupo][],
): Actividad[] {
  return plantilla.map(([nombre, grupo]) => {
    const actividad: Actividad = { id: nuevoId(), asignacionId, periodoId, nombre, grupo };
    db.actividades.push(actividad);
    return actividad;
  });
}

/** Registra la nota de cada estudiante en cada actividad; `valorDe` devuelve null para dejarla sin nota. */
function registrarNotas(
  db: BaseDatos,
  actividades: Actividad[],
  estudiantes: Estudiante[],
  valorDe: (indiceEstudiante: number, indiceActividad: number) => ValorNota | null,
): void {
  estudiantes.forEach((estudiante, ie) => {
    actividades.forEach((actividad, ia) => {
      const valor = valorDe(ie, ia);
      if (valor !== null) db.notas.push({ actividadId: actividad.id, estudianteId: estudiante.id, valor });
    });
  });
}

/**
 * Finaliza el periodo en la demo: calcula cada nota de periodo con calcularNotaPeriodo
 * y deja fecha = fechaFin del periodo (como si se hubiera finalizado ese día).
 */
function cerrarPeriodo(
  db: BaseDatos,
  perfil: Perfil,
  anio: AnioLectivo,
  asignacionId: string,
  periodo: Periodo,
  estudiantes: Estudiante[],
): void {
  const pct = anio.modoGrupos === 'varian' ? periodo.grupos : anio.gruposIguales;
  if (pct === undefined) throw new Error(`Demo: falta el porcentaje de grupos del periodo ${periodo.fechaInicio}.`);
  const actividades = db.actividades.filter((a) => a.asignacionId === asignacionId && a.periodoId === periodo.id);
  const notasCalculadas: Record<string, number> = {};
  for (const estudiante of estudiantes) {
    const porGrupo: Record<Grupo, ValorNota[]> = { ser: [], saber: [], hacer: [] };
    for (const actividad of actividades) {
      const nota = db.notas.find((n) => n.actividadId === actividad.id && n.estudianteId === estudiante.id);
      if (nota) porGrupo[actividad.grupo].push(nota.valor);
    }
    notasCalculadas[estudiante.id] = calcularNotaPeriodo(porGrupo, pct, perfil.escala);
  }
  db.cierres.push({ asignacionId, periodoId: periodo.id, fecha: periodo.fechaFin, notasCalculadas });
}

/** Carga los datos de demostración del AÑO ACTUAL (y un año anterior en el Perfil A). Sobrescribe la base. */
export async function cargarDemo(): Promise<void> {
  const db = dbVacia();
  const Y = anioActual();

  // Cuenta 1: Perfil A (numérico) y Perfil B (letras).
  const usuario1: Usuario = {
    id: nuevoId(),
    nombreCompleto: 'Carolina Herrera Mejía',
    correo: CORREO_DEMO,
    hashContrasena: await hashContrasena(SAL_DEMO, CONTRASENA_DEMO),
    sal: SAL_DEMO,
    fechaNacimiento: '1984-05-17',
    niveles: ['primaria', 'secundaria'],
    intentosFallidos: 0,
    bloqueado: false,
  };
  const usuario2: Usuario = {
    id: nuevoId(),
    nombreCompleto: 'Andrés Rojas Pineda',
    correo: CORREO_DEMO_2,
    hashContrasena: await hashContrasena(SAL_DEMO_2, CONTRASENA_DEMO),
    sal: SAL_DEMO_2,
    niveles: ['primaria'],
    intentosFallidos: 0,
    bloqueado: false,
  };
  db.usuarios.push(usuario1, usuario2);

  // ---------- Perfil A: "Colegio San José" (escala numérica) ----------
  const perfilA: Perfil = {
    id: nuevoId(),
    usuarioId: usuario1.id,
    nombre: 'Colegio San José',
    activo: true,
    escala: { tipo: 'numerica', notaMin: 0, notaMax: 5, decimales: 1 },
    notaAprobar: 3,
    nivelesNacionales: { bajo: 0, basico: 3, alto: 4, superior: 4.6 },
    asistenciaObligatoria: false,
  };
  db.perfiles.push(perfilA);

  const anioA: AnioLectivo = {
    id: nuevoId(), perfilId: perfilA.id, anio: Y,
    modoPesoPeriodos: 'varian', modoGrupos: 'iguales', gruposIguales: { ser: 20, saber: 50, hacer: 30 },
  };
  const anioAAnterior: AnioLectivo = {
    id: nuevoId(), perfilId: perfilA.id, anio: Y - 1,
    modoPesoPeriodos: 'iguales', modoGrupos: 'iguales', gruposIguales: { ser: 20, saber: 50, hacer: 30 },
  };
  db.anios.push(anioA, anioAAnterior);

  const periodosA = [
    nuevoPeriodo(db, anioA.id, fecha(Y, 1, 26), fecha(Y, 4, 17), { peso: 30 }),
    nuevoPeriodo(db, anioA.id, fecha(Y, 4, 20), fecha(Y, 7, 31), { peso: 30 }),
    nuevoPeriodo(db, anioA.id, fecha(Y, 8, 3), fecha(Y, 10, 30), { peso: 40 }),
  ];
  const periodosAnteriores = [
    nuevoPeriodo(db, anioAAnterior.id, fecha(Y - 1, 2, 2), fecha(Y - 1, 6, 30)),
    nuevoPeriodo(db, anioAAnterior.id, fecha(Y - 1, 7, 1), fecha(Y - 1, 11, 20)),
  ];

  const cursoNovenoA = { id: nuevoId(), anioLectivoId: anioA.id, grado: '9.°', grupo: 'A' };
  const cursoNovenoB = { id: nuevoId(), anioLectivoId: anioA.id, grado: '9.°', grupo: 'B' };
  const cursoDecimoA = { id: nuevoId(), anioLectivoId: anioA.id, grado: '10.°', grupo: 'A' };
  const cursoAnteriorNoveno = { id: nuevoId(), anioLectivoId: anioAAnterior.id, grado: '9.°', grupo: 'A' };
  db.cursos.push(cursoNovenoA, cursoNovenoB, cursoDecimoA, cursoAnteriorNoveno);

  const matematicasA = { id: nuevoId(), anioLectivoId: anioA.id, nombre: 'Matemáticas', area: 'Matemáticas' };
  const fisicaA = { id: nuevoId(), anioLectivoId: anioA.id, nombre: 'Física', area: 'Ciencias naturales' };
  const matematicasAnterior = { id: nuevoId(), anioLectivoId: anioAAnterior.id, nombre: 'Matemáticas', area: 'Matemáticas' };
  db.materias.push(matematicasA, fisicaA, matematicasAnterior);

  const asigNoveno_Mat = { id: nuevoId(), cursoId: cursoNovenoA.id, materiaId: matematicasA.id };
  const asigNovenoB_Mat = { id: nuevoId(), cursoId: cursoNovenoB.id, materiaId: matematicasA.id };
  const asigDecimo_Mat = { id: nuevoId(), cursoId: cursoDecimoA.id, materiaId: matematicasA.id };
  const asigDecimo_Fis = { id: nuevoId(), cursoId: cursoDecimoA.id, materiaId: fisicaA.id };
  const asigAnterior_Mat = { id: nuevoId(), cursoId: cursoAnteriorNoveno.id, materiaId: matematicasAnterior.id };
  db.asignaciones.push(asigNoveno_Mat, asigNovenoB_Mat, asigDecimo_Mat, asigDecimo_Fis, asigAnterior_Mat);

  const estudiantesNovenoA = nuevosEstudiantes(db, cursoNovenoA.id, [
    ['Juan Sebastián', 'Arias Londoño'],
    ['María Camila', 'Benítez Ortiz'],
    ['Daniel Felipe', 'Castaño Quintero'],
    ['Laura Sofía', 'Duque Montoya'],
    ['Andrés Mauricio', 'Erazo Rentería'],
    ['Sara Valentina', 'Figueroa Mosquera'],
  ]);
  const estudiantesNovenoB = nuevosEstudiantes(db, cursoNovenoB.id, [
    ['Mateo', 'Gutiérrez Pineda'],
    ['Isabella', 'Hernández Zapata'],
    ['Samuel', 'Jaramillo Cárdenas'],
    ['Natalia', 'Lozano Vargas'],
    ['Julián', 'Mejía Restrepo'],
    ['Paula Andrea', 'Ocampo Salazar'],
  ]);
  nuevosEstudiantes(db, cursoDecimoA.id, [
    ['Tomás', 'Ospina Villa'],
    ['Juliana', 'Peña Ramírez'],
    ['Nicolás', 'Quintero Bedoya'],
    ['Valeria', 'Rivera Cano'],
    ['Esteban', 'Salazar Giraldo'],
    ['Mariana', 'Torres Ocampo'],
  ]);
  const estudiantesAnterior = nuevosEstudiantes(db, cursoAnteriorNoveno.id, [
    ['Luisa Fernanda', 'Ayala Peña'],
    ['Daniel Ricardo', 'Forero Mesa'],
    ['Andrea Lucía', 'Vélez Holguín'],
  ]);

  // Plantillas de actividades por grupo.
  const PLANTILLA_COMPLETA: [string, Grupo][] = [
    ['Quiz de conceptos', 'ser'],
    ['Participación en clase', 'ser'],
    ['Taller de ecuaciones', 'saber'],
    ['Prueba escrita', 'saber'],
    ['Proyecto de aplicación', 'hacer'],
  ];
  const PLANTILLA_BASICA: [string, Grupo][] = [
    ['Quiz de conceptos', 'ser'],
    ['Taller de ecuaciones', 'saber'],
    ['Proyecto de aplicación', 'hacer'],
  ];

  // 9.° A: 3 periodos finalizados, notas variadas (algunos aprueban y otros no).
  const BASE_9A = [4.6, 3.8, 2.4, 4.1, 1.9, 3.3];
  const AJUSTE_ACTIVIDAD_9A = [0.2, -0.3, 0.4, -0.1, 0];
  const AJUSTE_PERIODO_9A = [0, 0.2, -0.2];
  periodosA.forEach((periodo, p) => {
    const actividades = nuevasActividades(db, asigNoveno_Mat.id, periodo.id, PLANTILLA_COMPLETA);
    registrarNotas(db, actividades, estudiantesNovenoA, (ie, ia) =>
      notaDecimal(BASE_9A[ie] + AJUSTE_ACTIVIDAD_9A[ia] + AJUSTE_PERIODO_9A[p]));
    cerrarPeriodo(db, perfilA, anioA, asigNoveno_Mat.id, periodo, estudiantesNovenoA);
  });

  // 9.° B: P1 finalizado; P2 con todas las notas (listo para finalizar); P3 con notas faltantes.
  const BASE_9B = [3.5, 4.2, 2.9, 4.8, 3.1, 2.2];
  const AJUSTE_ACTIVIDAD_9B = [0.1, -0.2, 0.3];
  const NOTAS_FALTANTES_9B_P3: [number, number][] = [[1, 0], [4, 2], [5, 1]];
  const actividadesB1 = nuevasActividades(db, asigNovenoB_Mat.id, periodosA[0].id, PLANTILLA_BASICA);
  registrarNotas(db, actividadesB1, estudiantesNovenoB, (ie, ia) => notaDecimal(BASE_9B[ie] + AJUSTE_ACTIVIDAD_9B[ia]));
  cerrarPeriodo(db, perfilA, anioA, asigNovenoB_Mat.id, periodosA[0], estudiantesNovenoB);

  const actividadesB2 = nuevasActividades(db, asigNovenoB_Mat.id, periodosA[1].id, PLANTILLA_BASICA);
  registrarNotas(db, actividadesB2, estudiantesNovenoB, (ie, ia) => notaDecimal(BASE_9B[ie] + AJUSTE_ACTIVIDAD_9B[ia] + 0.1));

  const actividadesB3 = nuevasActividades(db, asigNovenoB_Mat.id, periodosA[2].id, PLANTILLA_BASICA);
  registrarNotas(db, actividadesB3, estudiantesNovenoB, (ie, ia) =>
    NOTAS_FALTANTES_9B_P3.some(([x, y]) => x === ie && y === ia)
      ? null
      : notaDecimal(BASE_9B[ie] + AJUSTE_ACTIVIDAD_9B[ia] - 0.1));

  // 10.° A: sin cierres, con unas pocas actividades.
  nuevasActividades(db, asigDecimo_Mat.id, periodosA[0].id, [
    ['Quiz de números', 'ser'],
    ['Taller de funciones', 'saber'],
    ['Proyecto de matemáticas', 'hacer'],
  ]);
  nuevasActividades(db, asigDecimo_Fis.id, periodosA[0].id, [
    ['Laboratorio de péndulo', 'ser'],
    ['Quiz de cinemática', 'saber'],
  ]);

  // Año anterior (solo para verificar HU-09): 2 periodos finalizados, 1 curso, 1 materia, 1 asignación, 3 estudiantes.
  const BASE_ANTERIOR = [4.0, 2.6, 3.5];
  periodosAnteriores.forEach((periodo, p) => {
    const actividades = nuevasActividades(db, asigAnterior_Mat.id, periodo.id, PLANTILLA_BASICA);
    registrarNotas(db, actividades, estudiantesAnterior, (ie, ia) =>
      notaDecimal(BASE_ANTERIOR[ie] + (ia === 1 ? -0.2 : 0.1) + (p === 1 ? 0.2 : 0)));
    cerrarPeriodo(db, perfilA, anioAAnterior, asigAnterior_Mat.id, periodo, estudiantesAnterior);
  });

  // ---------- Perfil B: "Escuela Rural La Esperanza" (escala por letras) ----------
  const perfilB: Perfil = {
    id: nuevoId(),
    usuarioId: usuario1.id,
    nombre: 'Escuela Rural La Esperanza',
    activo: true,
    escala: {
      tipo: 'letras',
      letras: [
        { letra: 'A+', equivalente: 5 },
        { letra: 'B', equivalente: 4 },
        { letra: 'E', equivalente: 1 },
      ],
    },
    notaAprobar: 'B',
    nivelesNacionales: { bajo: 1, basico: 3, alto: 4, superior: 4.6 },
    asistenciaObligatoria: true,
  };
  db.perfiles.push(perfilB);

  const anioB: AnioLectivo = {
    id: nuevoId(), perfilId: perfilB.id, anio: Y,
    modoPesoPeriodos: 'iguales', modoGrupos: 'varian', gruposIguales: { ser: 0, saber: 0, hacer: 0 },
  };
  db.anios.push(anioB);

  const periodosB = [
    nuevoPeriodo(db, anioB.id, fecha(Y, 2, 2), fecha(Y, 4, 10), { grupos: { ser: 20, saber: 50, hacer: 30 } }),
    nuevoPeriodo(db, anioB.id, fecha(Y, 4, 13), fecha(Y, 6, 19), { grupos: { ser: 30, saber: 40, hacer: 30 } }),
    nuevoPeriodo(db, anioB.id, fecha(Y, 7, 6), fecha(Y, 9, 11), { grupos: { ser: 25, saber: 45, hacer: 30 } }),
    nuevoPeriodo(db, anioB.id, fecha(Y, 9, 14), fecha(Y, 11, 27), { grupos: { ser: 20, saber: 50, hacer: 30 } }),
  ];

  db.eventos.push(
    {
      id: nuevoId(), anioLectivoId: anioB.id, tipo: 'vacaciones', nombre: 'Vacaciones de mitad de año',
      fechaInicio: fecha(Y, 6, 15), fechaFin: fecha(Y, 6, 19),
    },
    {
      id: nuevoId(), anioLectivoId: anioB.id, tipo: 'actividad', nombre: 'Feria de ciencias',
      fechaInicio: fecha(Y, 8, 21), fechaFin: fecha(Y, 8, 21),
    },
  );

  const cursoTercero = { id: nuevoId(), anioLectivoId: anioB.id, grado: 'Tercero', grupo: 'A' };
  db.cursos.push(cursoTercero);

  const materiasB = ['Matemáticas', 'Lengua Castellana', 'Ciencias Naturales', 'Ciencias Sociales', 'Educación Artística']
    .map((nombre) => ({ id: nuevoId(), anioLectivoId: anioB.id, nombre }));
  db.materias.push(...materiasB);
  const asignacionesB = materiasB.map((m) => ({ id: nuevoId(), cursoId: cursoTercero.id, materiaId: m.id }));
  db.asignaciones.push(...asignacionesB);

  const estudiantesTercero = nuevosEstudiantes(db, cursoTercero.id, [
    ['Emilia', 'Acosta Builes'],
    ['Miguel Ángel', 'Bustamante Ruiz'],
    ['Sofía', 'Cifuentes Parra'],
    ['Lucas', 'Dávila Mora'],
    ['Gabriela', 'Escobar Nieto'],
  ]);

  // Dos actividades con notas en el periodo 1 (letras), para mostrar letras y HU-06.5.
  const LETRAS_SABER = ['A+', 'B', 'E', 'B', 'A+'];
  const LETRAS_HACER = ['B', 'B', 'E', 'A+', 'B'];
  const asigMatTercero = asignacionesB[0];
  const actividadSaber = nuevasActividades(db, asigMatTercero.id, periodosB[0].id, [['Prueba de sumas', 'saber']]);
  const actividadHacer = nuevasActividades(db, asigMatTercero.id, periodosB[0].id, [['Taller en clase', 'hacer']]);
  registrarNotas(db, actividadSaber, estudiantesTercero, (ie) => LETRAS_SABER[ie]);
  registrarNotas(db, actividadHacer, estudiantesTercero, (ie) => LETRAS_HACER[ie]);

  // ---------- Cuenta 2: perfil propio, un curso, una materia, una asignación, un periodo y 2 estudiantes ----------
  const perfilC: Perfil = {
    id: nuevoId(),
    usuarioId: usuario2.id,
    nombre: 'Colegio Nuevo Horizonte',
    activo: true,
    escala: { tipo: 'numerica', notaMin: 0, notaMax: 5, decimales: 2 },
    notaAprobar: 3,
    nivelesNacionales: { bajo: 0, basico: 3, alto: 4, superior: 4.6 },
    asistenciaObligatoria: false,
  };
  db.perfiles.push(perfilC);
  const anioC: AnioLectivo = {
    id: nuevoId(), perfilId: perfilC.id, anio: Y,
    modoPesoPeriodos: 'iguales', modoGrupos: 'iguales', gruposIguales: { ser: 20, saber: 50, hacer: 30 },
  };
  db.anios.push(anioC);
  nuevoPeriodo(db, anioC.id, fecha(Y, 2, 2), fecha(Y, 11, 27));
  const cursoSexto = { id: nuevoId(), anioLectivoId: anioC.id, grado: 'Sexto', grupo: 'A' };
  db.cursos.push(cursoSexto);
  const materiaC = { id: nuevoId(), anioLectivoId: anioC.id, nombre: 'Ciencias Naturales' };
  db.materias.push(materiaC);
  db.asignaciones.push({ id: nuevoId(), cursoId: cursoSexto.id, materiaId: materiaC.id });
  nuevosEstudiantes(db, cursoSexto.id, [
    ['Ana María', 'Pardo Londoño'],
    ['Felipe', 'Orozco Maya'],
  ]);

  escribirDb((destino) => {
    Object.assign(destino, db);
  });
}
