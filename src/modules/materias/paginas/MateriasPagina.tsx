import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Curso, Materia } from '@/core/tipos';
import { ErrorAcceso } from '@/core/errores';
import { useApp } from '@/layout/ContextoApp';
import { listarCursos } from '@/modules/cursos/cursos.servicio';
import * as materiasServicio from '@/modules/materias/materias.servicio';
import type { AsignacionDetalle } from '@/modules/materias/materias.servicio';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  EstadoVacio,
  Entrada,
  Insignia,
  Seleccion,
  SinPermiso,
  Tarjeta,
  aplicarErroresCampos,
  mensajeError,
  useConfirmacion,
  useRecurso,
} from '@/ui';

const ENLACE =
  'inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100';

const esquemaMateria = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre de la materia.'),
  area: z.string().trim(),
});
type DatosMateria = z.infer<typeof esquemaMateria>;
const VACIO_MATERIA: DatosMateria = { nombre: '', area: '' };

const esquemaAsignar = z.object({
  cursoId: z.string().min(1, 'Elige un curso.'),
  materiaId: z.string().min(1, 'Elige una materia.'),
});
type DatosAsignar = z.infer<typeof esquemaAsignar>;
const VACIO_ASIGNAR: DatosAsignar = { cursoId: '', materiaId: '' };

interface Carga {
  cursos: Curso[];
  materias: Materia[];
  asignaciones: AsignacionDetalle[];
}

async function cargarCarga(anioId: string): Promise<Carga> {
  const [cursos, materias, asignaciones] = await Promise.all([
    listarCursos(anioId),
    materiasServicio.listarMaterias(anioId),
    materiasServicio.listarAsignaciones(anioId),
  ]);
  return { cursos, materias, asignaciones };
}

const plural = (n: number, singular: string, plu: string) => `${n} ${n === 1 ? singular : plu}`;

export function MateriasPagina() {
  const app = useApp();

  if (app.cargando) {
    return (
      <>
        <Encabezado titulo="Materias y carga académica" />
        <Cargando />
      </>
    );
  }

  if (!app.perfil || !app.anio) {
    return (
      <>
        <Encabezado titulo="Materias y carga académica" />
        <EstadoVacio
          titulo="Primero crea un perfil de institución"
          descripcion="Las materias se registran dentro del año lectivo de un perfil."
          accion={<Link to="/perfiles" className={ENLACE}>Ir a perfiles</Link>}
        />
      </>
    );
  }

  return (
    <MateriasDelAnio
      anioId={app.anio.id}
      anioLectivo={app.anio.anio}
      soloLectura={app.soloLectura}
      motivoSoloLectura={app.motivoSoloLectura}
    />
  );
}

interface MateriasDelAnioProps {
  anioId: string;
  anioLectivo: number;
  soloLectura: boolean;
  motivoSoloLectura: string | null;
}

function MateriasDelAnio({ anioId, anioLectivo, soloLectura, motivoSoloLectura }: MateriasDelAnioProps) {
  const recurso = useRecurso(() => cargarCarga(anioId), [anioId]);
  const { pedir, dialogo } = useConfirmacion();
  const [error, setError] = useState<string | null>(null);
  const [errorAsignar, setErrorAsignar] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const formMateria = useForm<DatosMateria>({ resolver: zodResolver(esquemaMateria), defaultValues: VACIO_MATERIA });
  const formAsignar = useForm<DatosAsignar>({ resolver: zodResolver(esquemaAsignar), defaultValues: VACIO_ASIGNAR });

  const datos = recurso.datos;

  const porClave = useMemo(() => {
    const mapa = new Map<string, AsignacionDetalle>();
    for (const a of datos?.asignaciones ?? []) mapa.set(`${a.curso.id}|${a.materia.id}`, a);
    return mapa;
  }, [datos]);

  if (recurso.error instanceof ErrorAcceso) return <SinPermiso />;

  async function crearMateria(nuevos: DatosMateria) {
    setError(null);
    try {
      await materiasServicio.crearMateria(anioId, nuevos);
      formMateria.reset(VACIO_MATERIA);
      recurso.recargar();
    } catch (e) {
      if (!aplicarErroresCampos(e, formMateria.setError)) setError(mensajeError(e));
    }
  }

  async function eliminarMateria(materia: Materia) {
    setError(null);
    const ok = await pedir({
      titulo: '¿Eliminar esta materia?',
      mensaje: `Se eliminará «${materia.nombre}» de este año lectivo. Solo es posible si no está asignada a ningún curso.`,
      textoConfirmar: 'Eliminar materia',
      peligro: true,
    });
    if (!ok) return;
    try {
      await materiasServicio.eliminarMateria(materia.id);
      recurso.recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  async function asignar(nuevos: DatosAsignar) {
    setErrorAsignar(null);
    try {
      await materiasServicio.crearAsignacion(nuevos.cursoId, nuevos.materiaId);
      formAsignar.reset(VACIO_ASIGNAR);
      recurso.recargar();
    } catch (e) {
      setErrorAsignar(mensajeError(e));
    }
  }

  /** Casilla de la matriz: marcar crea la asignación; desmarcar la quita tras confirmar. */
  async function alternar(curso: Curso, materia: Materia, marcar: boolean) {
    setError(null);
    const clave = `${curso.id}|${materia.id}`;
    setGuardando(clave);
    try {
      if (marcar) {
        await materiasServicio.crearAsignacion(curso.id, materia.id);
      } else {
        const existente = porClave.get(clave);
        if (!existente) return;
        const lineas = await materiasServicio.resumenEliminarAsignacion(existente.asignacion.id);
        const ok = await pedir({
          titulo: '¿Quitar esta materia del curso?',
          mensaje: `Se quitará «${materia.nombre}» de ${curso.grado} ${curso.grupo}.`,
          lineas,
          textoConfirmar: 'Quitar materia',
          peligro: true,
        });
        if (!ok) return;
        await materiasServicio.eliminarAsignacion(existente.asignacion.id);
      }
      recurso.recargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(null);
    }
  }

  if (!datos) {
    return (
      <>
        <Encabezado titulo="Materias y carga académica" />
        {recurso.cargando ? <Cargando /> : <Aviso tipo="error">{mensajeError(recurso.error)}</Aviso>}
      </>
    );
  }

  const { cursos, materias, asignaciones } = datos;

  return (
    <>
      <Encabezado
        titulo="Materias y carga académica"
        descripcion={`Año lectivo ${anioLectivo}. Crea materias y asígnalas a los cursos en cualquier combinación.`}
      />

      {soloLectura && motivoSoloLectura ? (
        <Aviso tipo="info" className="mb-5">
          {motivoSoloLectura}. No se pueden cambiar materias ni asignaciones.
        </Aviso>
      ) : null}
      {error ? (
        <Aviso tipo="error" className="mb-5">
          {error}
        </Aviso>
      ) : null}
      {recurso.error ? (
        <Aviso tipo="error" className="mb-5">
          {mensajeError(recurso.error)}
        </Aviso>
      ) : null}

      <fieldset disabled={soloLectura} className="min-w-0 border-0 p-0">
        <Tarjeta titulo="Crear materia" className="mb-5">
          <form
            noValidate
            onSubmit={formMateria.handleSubmit(crearMateria)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
          >
            <Campo label="Nombre" error={formMateria.formState.errors.nombre?.message}>
              <Entrada placeholder="Ej.: Matemáticas" {...formMateria.register('nombre')} />
            </Campo>
            <Campo label="Área" hint="Opcional" error={formMateria.formState.errors.area?.message}>
              <Entrada placeholder="Ej.: Matemáticas" {...formMateria.register('area')} />
            </Campo>
            <Boton type="submit" className="sm:mt-6" disabled={formMateria.formState.isSubmitting}>
              Crear materia
            </Boton>
          </form>
        </Tarjeta>

        <Tarjeta
          titulo="Materias del año"
          acciones={<span className="text-sm text-slate-600">{plural(materias.length, 'materia', 'materias')}</span>}
          className="mb-5"
        >
          {materias.length === 0 ? (
            <EstadoVacio titulo="Aún no hay materias en este año" descripcion="Crea la primera con el formulario de arriba." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-600">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Materia</th>
                    <th scope="col" className="px-3 py-2 font-medium">Área</th>
                    <th scope="col" className="px-3 py-2 font-medium">Cursos asignados</th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {materias.map((materia) => {
                    const cursosAsignados = asignaciones.filter((a) => a.materia.id === materia.id).length;
                    return (
                      <tr key={materia.id}>
                        <td className="px-3 py-2 font-medium text-slate-900">{materia.nombre}</td>
                        <td className="px-3 py-2 text-slate-700">{materia.area ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{cursosAsignados}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end">
                            <Boton variant="peligro" onClick={() => void eliminarMateria(materia)}>
                              Eliminar
                            </Boton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Carga académica"
          acciones={<span className="text-sm text-slate-600">{plural(asignaciones.length, 'combinación', 'combinaciones')}</span>}
          className="mb-5"
        >
          <p className="mb-3 text-sm text-slate-600">
            Marca una casilla para asignar la materia al curso. Desmárcala para quitarla; se pedirá confirmación.
          </p>
          {cursos.length === 0 || materias.length === 0 ? (
            <EstadoVacio
              titulo={cursos.length === 0 ? 'No hay cursos en este año' : 'No hay materias en este año'}
              descripcion={
                cursos.length === 0
                  ? 'Crea los cursos para poder asignarles materias.'
                  : 'Crea las materias para poder asignarlas a los cursos.'
              }
            />
          ) : (
            <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-200">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 top-0 z-20 min-w-[9rem] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-800"
                    >
                      Curso
                    </th>
                    {materias.map((materia) => (
                      <th
                        key={materia.id}
                        scope="col"
                        className="sticky top-0 z-10 min-w-[7rem] border-b border-slate-200 bg-slate-50 px-2 py-2 text-center font-medium text-slate-800"
                      >
                        {materia.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cursos.map((curso) => (
                    <tr key={curso.id}>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-left font-medium text-slate-900"
                      >
                        {curso.grado} {curso.grupo}
                      </th>
                      {materias.map((materia) => {
                        const clave = `${curso.id}|${materia.id}`;
                        return (
                          <td key={materia.id} className="border-b border-slate-100 px-2 text-center">
                            <label className="inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center">
                              <input
                                type="checkbox"
                                className="h-5 w-5 accent-teal-700"
                                aria-label={`${materia.nombre} en ${curso.grado} ${curso.grupo}`}
                                checked={porClave.has(clave)}
                                disabled={guardando !== null}
                                onChange={(ev) => void alternar(curso, materia, ev.target.checked)}
                              />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Asignar una materia a un curso" className="mb-5">
          <form
            noValidate
            onSubmit={formAsignar.handleSubmit(asignar)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
          >
            <Campo label="Curso" error={formAsignar.formState.errors.cursoId?.message}>
              <Seleccion {...formAsignar.register('cursoId')}>
                <option value="">Elige un curso</option>
                {cursos.map((curso) => (
                  <option key={curso.id} value={curso.id}>
                    {curso.grado} {curso.grupo}
                  </option>
                ))}
              </Seleccion>
            </Campo>
            <Campo label="Materia" error={formAsignar.formState.errors.materiaId?.message}>
              <Seleccion {...formAsignar.register('materiaId')}>
                <option value="">Elige una materia</option>
                {materias.map((materia) => (
                  <option key={materia.id} value={materia.id}>
                    {materia.nombre}
                  </option>
                ))}
              </Seleccion>
            </Campo>
            <Boton type="submit" className="sm:mt-6" disabled={formAsignar.formState.isSubmitting}>
              Asignar
            </Boton>
          </form>
          {errorAsignar ? (
            <Aviso tipo="error" className="mt-3">
              {errorAsignar}
            </Aviso>
          ) : null}
        </Tarjeta>

        <Tarjeta
          titulo="Combinaciones curso–materia"
          acciones={<Insignia tono="info">Total: {plural(asignaciones.length, 'combinación', 'combinaciones')}</Insignia>}
          className="mb-5"
        >
          {asignaciones.length === 0 ? (
            <EstadoVacio titulo="Aún no hay combinaciones" descripcion="Marca casillas en la carga académica o usa el formulario de asignación." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {asignaciones.map(({ asignacion, curso, materia }) => (
                <li key={asignacion.id} className="py-2 text-sm text-slate-800">
                  {curso.grado} {curso.grupo} – {materia.nombre}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </fieldset>

      {dialogo}
    </>
  );
}
