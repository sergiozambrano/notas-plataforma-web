import type { AnioLectivo, PorcentajesGrupos } from '@/core/tipos';
import { ErrorValidacion } from '@/core/errores';
import { escribirDb, leerDb } from '@/core/almacen';
import { anioPropio, perfilPropio } from '@/core/acceso';
import { asegurarAnioEditable, asegurarEstructuraPeriodos } from '@/core/bloqueos';
import { validarGrupos, validarPesos, ordenarPeriodos, numeroPeriodo } from '@/modules/periodos/validaciones';

export interface ResumenCarga {
  cursos: number;
  materias: number;
  asignaciones: number;
  estudiantes: number;
}

export interface ConfiguracionAnio {
  modoPesoPeriodos: 'iguales' | 'varian';
  modoGrupos: 'iguales' | 'varian';
  gruposIguales: PorcentajesGrupos;
  periodos: { id: string; peso?: number; grupos?: PorcentajesGrupos }[];
}

export async function listarAnios(perfilId: string): Promise<AnioLectivo[]> {
  const db = leerDb();
  perfilPropio(db, perfilId);
  return db.anios.filter((a) => a.perfilId === perfilId).sort((a, b) => b.anio - a.anio);
}

export async function obtenerAnio(id: string): Promise<AnioLectivo> {
  return anioPropio(leerDb(), id);
}

export async function resumenCarga(anioId: string): Promise<ResumenCarga> {
  const db = leerDb();
  anioPropio(db, anioId);
  const cursoIds = new Set(db.cursos.filter((c) => c.anioLectivoId === anioId).map((c) => c.id));
  return {
    cursos: cursoIds.size,
    materias: db.materias.filter((m) => m.anioLectivoId === anioId).length,
    asignaciones: db.asignaciones.filter((a) => cursoIds.has(a.cursoId)).length,
    estudiantes: db.estudiantes.filter((e) => cursoIds.has(e.cursoId)).length,
  };
}

export async function guardarConfiguracion(anioId: string, config: ConfiguracionAnio): Promise<void> {
  escribirDb((db) => {
    const anio = anioPropio(db, anioId);
    asegurarAnioEditable(db, anioId);

    const periodosAnio = db.periodos.filter((p) => p.anioLectivoId === anioId);
    const antes = JSON.stringify({
      modos: [anio.modoPesoPeriodos, anio.modoGrupos, anio.gruposIguales],
      periodos: ordenarPeriodos(periodosAnio).map((p) => [p.id, p.peso, p.grupos]),
    });

    // Valores propuestos por periodo. Los que no vienen en `config` se conservan.
    const propuestos = ordenarPeriodos(periodosAnio).map((p) => {
      const entrada = config.periodos.find((x) => x.id === p.id);
      return {
        id: p.id,
        peso: config.modoPesoPeriodos === 'varian' ? (entrada ? entrada.peso : p.peso) : undefined,
        grupos: config.modoGrupos === 'varian' ? (entrada ? entrada.grupos : p.grupos) : undefined,
      };
    });

    const errores: Record<string, string> = {};
    if (config.modoPesoPeriodos === 'varian') {
      const mensaje = validarPesos(propuestos.map((p) => p.peso));
      if (mensaje) errores.pesos = mensaje;
    }
    if (config.modoGrupos === 'varian') {
      const mensajes: string[] = [];
      for (const p of propuestos) {
        if (!p.grupos) {
          mensajes.push(`Periodo ${numeroPeriodo(p.id, periodosAnio)}: faltan los porcentajes de Ser, Saber y Hacer.`);
          continue;
        }
        const mensaje = validarGrupos(p.grupos);
        if (mensaje) mensajes.push(`Periodo ${numeroPeriodo(p.id, periodosAnio)}: ${mensaje}`);
      }
      if (mensajes.length > 0) errores.grupos = mensajes.join(' ');
    } else {
      const mensaje = validarGrupos(config.gruposIguales);
      if (mensaje) errores.gruposIguales = mensaje;
    }
    if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);

    const despues = JSON.stringify({
      modos: [config.modoPesoPeriodos, config.modoGrupos, config.gruposIguales],
      periodos: propuestos.map((p) => [p.id, p.peso, p.grupos]),
    });
    if (antes !== despues) asegurarEstructuraPeriodos(db, anioId);

    anio.modoPesoPeriodos = config.modoPesoPeriodos;
    anio.modoGrupos = config.modoGrupos;
    anio.gruposIguales = { ...config.gruposIguales };
    for (const propuesto of propuestos) {
      const periodo = db.periodos.find((p) => p.id === propuesto.id);
      if (!periodo) continue;
      if (propuesto.peso === undefined) delete periodo.peso;
      else periodo.peso = propuesto.peso;
      if (propuesto.grupos === undefined) delete periodo.grupos;
      else periodo.grupos = { ...propuesto.grupos };
    }
  });
}
