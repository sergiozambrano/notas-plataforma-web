import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AnioLectivo, Curso, Estudiante, Perfil } from '@/core/tipos';
import { ErrorAcceso, ErrorAdvertencia } from '@/core/errores';
import { motivoSoloLectura } from '@/core/bloqueos';
import { useApp } from '@/layout/ContextoApp';
import { obtenerAnio } from '@/modules/anios/anios.servicio';
import { obtenerCurso } from '@/modules/cursos/cursos.servicio';
import {
  crearEstudiante,
  eliminarEstudiante,
  listarEstudiantes,
  resumenEliminarEstudiante,
} from '@/modules/estudiantes/estudiantes.servicio';
import { listarAsignaciones } from '@/modules/materias/materias.servicio';
import type { AsignacionDetalle } from '@/modules/materias/materias.servicio';
import { obtenerPerfil } from '@/modules/perfiles/perfiles.servicio';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  EstadoVacio,
  Entrada,
  SinPermiso,
  Tarjeta,
  aplicarErroresCampos,
  mensajeError,
  useConfirmacion,
  useRecurso,
} from '@/ui';

const ENLACE =
  'inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100';

const esquema = z.object({
  nombres: z.string().trim().min(1, 'Escribe los nombres.'),
  apellidos: z.string().trim().min(1, 'Escribe los apellidos.'),
  codigo: z.string().trim(),
});
type DatosEstudiante = z.infer<typeof esquema>;
const VACIO: DatosEstudiante = { nombres: '', apellidos: '', codigo: '' };

interface DatosCurso {
  curso: Curso;
  anio: AnioLectivo;
  perfil: Perfil;
  estudiantes: Estudiante[];
  materias: AsignacionDetalle[];
}

/** Carga el curso y, desde él, su año y su perfil (el recurso manda, no el selector). */
async function cargarCurso(cursoId: string): Promise<DatosCurso> {
  const curso = await obtenerCurso(cursoId);
  const anio = await obtenerAnio(curso.anioLectivoId);
  const perfil = await obtenerPerfil(anio.perfilId);
  const [estudiantes, asignaciones] = await Promise.all([
    listarEstudiantes(cursoId),
    listarAsignaciones(anio.id),
  ]);
  return {
    curso,
    anio,
    perfil,
    estudiantes,
    materias: asignaciones.filter((a) => a.curso.id === cursoId),
  };
}

export function EstudiantesCursoPagina() {
  const { cursoId = '' } = useParams();
  const { perfil: perfilSeleccionado, anio: anioSeleccionado, sincronizar } = useApp();
  const recurso = useRecurso(() => cargarCurso(cursoId), [cursoId]);
  const datos = recurso.datos;
  const perfilSeleccionadoId = perfilSeleccionado?.id;
  const anioSeleccionadoId = anioSeleccionado?.id;

  // Si el curso pertenece a otro perfil o año, el selector de la barra se sincroniza con él.
  useEffect(() => {
    if (!datos) return;
    if (perfilSeleccionadoId === datos.perfil.id && anioSeleccionadoId === datos.anio.id) return;
    void sincronizar(datos.perfil.id, datos.anio.id);
  }, [datos, perfilSeleccionadoId, anioSeleccionadoId, sincronizar]);

  if (recurso.error instanceof ErrorAcceso) return <SinPermiso />;

  if (!datos) {
    return (
      <>
        <Encabezado titulo="Estudiantes del curso" />
        {recurso.cargando ? <Cargando /> : <Aviso tipo="error">{mensajeError(recurso.error)}</Aviso>}
      </>
    );
  }

  return <EstudiantesDelCurso datos={datos} recargar={recurso.recargar} />;
}

interface EstudiantesDelCursoProps {
  datos: DatosCurso;
  recargar: () => void;
}

function EstudiantesDelCurso({ datos, recargar }: EstudiantesDelCursoProps) {
  const { curso, anio, perfil, estudiantes, materias } = datos;
  const motivo = motivoSoloLectura(perfil, anio);
  const { pedir, dialogo } = useConfirmacion();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<DatosEstudiante>({ resolver: zodResolver(esquema), defaultValues: VACIO });
  const nombreCurso = `${curso.grado} ${curso.grupo}`;

  function falloAlRegistrar(e: unknown) {
    if (!aplicarErroresCampos(e, form.setError)) setError(mensajeError(e));
  }

  async function registrar(nuevo: DatosEstudiante) {
    setError(null);
    try {
      await crearEstudiante(curso.id, nuevo);
      form.reset(VACIO);
      recargar();
    } catch (e) {
      if (!(e instanceof ErrorAdvertencia)) {
        falloAlRegistrar(e);
        return;
      }
      const ok = await pedir({
        titulo: 'Posible estudiante repetido',
        mensaje: e.message,
        textoConfirmar: 'Registrar igual',
      });
      if (!ok) return;
      try {
        await crearEstudiante(curso.id, nuevo, { confirmado: true });
        form.reset(VACIO);
        recargar();
      } catch (e2) {
        falloAlRegistrar(e2);
      }
    }
  }

  async function eliminar(estudiante: Estudiante) {
    setError(null);
    try {
      const lineas = await resumenEliminarEstudiante(estudiante.id);
      const ok = await pedir({
        titulo: '¿Eliminar este estudiante?',
        mensaje: `Se eliminará a ${estudiante.apellidos} ${estudiante.nombres} con lo siguiente:`,
        lineas,
        textoConfirmar: 'Eliminar estudiante',
        peligro: true,
      });
      if (!ok) return;
      await eliminarEstudiante(estudiante.id);
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <>
      <Encabezado
        titulo={`Estudiantes de ${nombreCurso}`}
        descripcion={`Año lectivo ${anio.anio} · Perfil ${perfil.nombre}`}
        acciones={<Link to="/estudiantes" className={ENLACE}>Cambiar de curso</Link>}
      />

      {motivo ? (
        <Aviso tipo="info" className="mb-5">
          {motivo}. No se pueden registrar ni eliminar estudiantes.
        </Aviso>
      ) : null}
      {error ? (
        <Aviso tipo="error" className="mb-5">
          {error}
        </Aviso>
      ) : null}

      <fieldset disabled={motivo !== null} className="min-w-0 border-0 p-0">
        <Tarjeta titulo="Registrar estudiante" className="mb-5">
          <form
            noValidate
            onSubmit={form.handleSubmit(registrar)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-start"
          >
            <Campo label="Nombres" error={form.formState.errors.nombres?.message}>
              <Entrada autoComplete="off" {...form.register('nombres')} />
            </Campo>
            <Campo label="Apellidos" error={form.formState.errors.apellidos?.message}>
              <Entrada autoComplete="off" {...form.register('apellidos')} />
            </Campo>
            <Campo label="Código interno" hint="Opcional" error={form.formState.errors.codigo?.message}>
              <Entrada autoComplete="off" {...form.register('codigo')} />
            </Campo>
            <Boton type="submit" className="sm:mt-6" disabled={form.formState.isSubmitting}>
              Registrar
            </Boton>
          </form>
        </Tarjeta>

        <Tarjeta
          titulo="Lista del curso"
          acciones={
            <span className="text-sm text-slate-600">
              {estudiantes.length} {estudiantes.length === 1 ? 'estudiante' : 'estudiantes'}
            </span>
          }
          className="mb-5"
        >
          {estudiantes.length === 0 ? (
            <EstadoVacio titulo="Aún no hay estudiantes en este curso" descripcion="Regístralos con el formulario de arriba." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-600">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Apellidos</th>
                    <th scope="col" className="px-3 py-2 font-medium">Nombres</th>
                    <th scope="col" className="px-3 py-2 font-medium">Código</th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {estudiantes.map((estudiante) => (
                    <tr key={estudiante.id}>
                      <td className="px-3 py-2 font-medium text-slate-900">{estudiante.apellidos}</td>
                      <td className="px-3 py-2 text-slate-800">{estudiante.nombres}</td>
                      <td className="px-3 py-2 text-slate-700">{estudiante.codigo ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end">
                          <Boton variant="peligro" onClick={() => void eliminar(estudiante)}>
                            Eliminar
                          </Boton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      </fieldset>

      <Tarjeta titulo="Materias de este curso" className="mb-5">
        {materias.length === 0 ? (
          <EstadoVacio
            titulo="Este curso no tiene materias asignadas"
            descripcion="Asígnalas en Materias y carga académica."
            accion={<Link to="/materias" className={ENLACE}>Ir a materias</Link>}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {materias.map(({ asignacion, materia }) => (
              <li key={asignacion.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{materia.nombre}</p>
                  {materia.area ? <p className="text-sm text-slate-600">{materia.area}</p> : null}
                </div>
                <Link to="/planilla" className={ENLACE}>
                  Ver planilla
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {dialogo}
    </>
  );
}
