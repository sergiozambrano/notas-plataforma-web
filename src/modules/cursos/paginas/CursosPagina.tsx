import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Curso } from '@/core/tipos';
import { ErrorAcceso } from '@/core/errores';
import { useApp } from '@/layout/ContextoApp';
import {
  crearCurso,
  eliminarCurso,
  listarCursos,
  resumenEliminarCurso,
} from '@/modules/cursos/cursos.servicio';
import { listarEstudiantes } from '@/modules/estudiantes/estudiantes.servicio';
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
  grado: z.string().trim().min(1, 'Escribe el grado, por ejemplo "Quinto".'),
  grupo: z.string().trim().min(1, 'Escribe el grupo, por ejemplo "A".'),
});
type DatosCurso = z.infer<typeof esquema>;

const VACIO: DatosCurso = { grado: '', grupo: '' };

interface FilaCurso {
  curso: Curso;
  estudiantes: number;
}

async function cargarFilas(anioId: string): Promise<FilaCurso[]> {
  const cursos = await listarCursos(anioId);
  const conteos = await Promise.all(cursos.map((c) => listarEstudiantes(c.id)));
  return cursos.map((curso, i) => ({ curso, estudiantes: conteos[i].length }));
}

export function CursosPagina() {
  const app = useApp();

  if (app.cargando) {
    return (
      <>
        <Encabezado titulo="Cursos" />
        <Cargando />
      </>
    );
  }

  if (!app.perfil || !app.anio) {
    return (
      <>
        <Encabezado titulo="Cursos" />
        <EstadoVacio
          titulo="Primero crea un perfil de institución"
          descripcion="Los cursos se registran dentro del año lectivo de un perfil."
          accion={<Link to="/perfiles" className={ENLACE}>Ir a perfiles</Link>}
        />
      </>
    );
  }

  return (
    <CursosDelAnio
      anioId={app.anio.id}
      anioLectivo={app.anio.anio}
      soloLectura={app.soloLectura}
      motivoSoloLectura={app.motivoSoloLectura}
    />
  );
}

interface CursosDelAnioProps {
  anioId: string;
  anioLectivo: number;
  soloLectura: boolean;
  motivoSoloLectura: string | null;
}

function CursosDelAnio({ anioId, anioLectivo, soloLectura, motivoSoloLectura }: CursosDelAnioProps) {
  const recurso = useRecurso(() => cargarFilas(anioId), [anioId]);
  const { pedir, dialogo } = useConfirmacion();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<DatosCurso>({ resolver: zodResolver(esquema), defaultValues: VACIO });

  if (recurso.error instanceof ErrorAcceso) return <SinPermiso />;

  const filas = recurso.datos;

  async function crear(datos: DatosCurso) {
    setError(null);
    try {
      await crearCurso(anioId, datos);
      form.reset(VACIO);
      recurso.recargar();
    } catch (e) {
      if (!aplicarErroresCampos(e, form.setError)) setError(mensajeError(e));
    }
  }

  async function eliminar(curso: Curso) {
    setError(null);
    try {
      const lineas = await resumenEliminarCurso(curso.id);
      const ok = await pedir({
        titulo: '¿Eliminar este curso?',
        mensaje: `Se eliminará el curso ${curso.grado} ${curso.grupo} y esto que contiene:`,
        lineas,
        textoConfirmar: 'Eliminar curso',
        peligro: true,
      });
      if (!ok) return;
      await eliminarCurso(curso.id);
      recurso.recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  const totalTexto = filas ? `${filas.length} ${filas.length === 1 ? 'curso' : 'cursos'}` : null;

  return (
    <>
      <Encabezado
        titulo="Cursos"
        descripcion={`Año lectivo ${anioLectivo}. Cada curso agrupa sus estudiantes y las materias que se dictan en él.`}
      />

      {soloLectura && motivoSoloLectura ? (
        <Aviso tipo="info" className="mb-5">
          {motivoSoloLectura}. No se pueden crear ni eliminar cursos.
        </Aviso>
      ) : null}
      {error ? (
        <Aviso tipo="error" className="mb-5">
          {error}
        </Aviso>
      ) : null}
      {recurso.error && !(recurso.error instanceof ErrorAcceso) ? (
        <Aviso tipo="error" className="mb-5">
          {mensajeError(recurso.error)}
        </Aviso>
      ) : null}

      {!soloLectura ? (
        <Tarjeta titulo="Crear curso" className="mb-5">
          <form
            noValidate
            onSubmit={form.handleSubmit(crear)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
          >
            <Campo label="Grado" error={form.formState.errors.grado?.message}>
              <Entrada placeholder="Ej.: Quinto" {...form.register('grado')} />
            </Campo>
            <Campo label="Grupo" error={form.formState.errors.grupo?.message}>
              <Entrada placeholder="Ej.: A" {...form.register('grupo')} />
            </Campo>
            <Boton type="submit" className="sm:mt-6" disabled={form.formState.isSubmitting}>
              Crear curso
            </Boton>
          </form>
        </Tarjeta>
      ) : null}

      <Tarjeta
        titulo={`Cursos del año ${anioLectivo}`}
        acciones={totalTexto ? <span className="text-sm text-slate-600">{totalTexto}</span> : null}
      >
        {recurso.cargando && !filas ? <Cargando /> : null}

        {filas && filas.length === 0 ? (
          <EstadoVacio
            titulo="Aún no hay cursos en este año"
            descripcion={soloLectura ? undefined : 'Crea el primero con el formulario de arriba.'}
          />
        ) : null}

        {filas && filas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Grado</th>
                  <th scope="col" className="px-3 py-2 font-medium">Grupo</th>
                  <th scope="col" className="px-3 py-2 font-medium">Estudiantes</th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map(({ curso, estudiantes }) => (
                  <tr key={curso.id}>
                    <td className="px-3 py-2 font-medium text-slate-900">{curso.grado}</td>
                    <td className="px-3 py-2 text-slate-800">{curso.grupo}</td>
                    <td className="px-3 py-2 text-slate-800">{estudiantes}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link to={`/estudiantes/${curso.id}`} className={ENLACE}>
                          Ver estudiantes
                        </Link>
                        {!soloLectura ? (
                          <Boton variant="peligro" onClick={() => void eliminar(curso)}>
                            Eliminar
                          </Boton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Tarjeta>

      {dialogo}
    </>
  );
}
