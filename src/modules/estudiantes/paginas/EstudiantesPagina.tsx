import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorAcceso } from '@/core/errores';
import { useApp } from '@/layout/ContextoApp';
import { listarCursos } from '@/modules/cursos/cursos.servicio';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  EstadoVacio,
  Seleccion,
  SinPermiso,
  Tarjeta,
  mensajeError,
  useRecurso,
} from '@/ui';

const ENLACE =
  'inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100';

export function EstudiantesPagina() {
  const app = useApp();

  if (app.cargando) {
    return (
      <>
        <Encabezado titulo="Estudiantes" />
        <Cargando />
      </>
    );
  }

  if (!app.perfil || !app.anio) {
    return (
      <>
        <Encabezado titulo="Estudiantes" />
        <EstadoVacio
          titulo="Primero crea un perfil de institución"
          descripcion="Los estudiantes se registran en los cursos de un año lectivo."
          accion={<Link to="/perfiles" className={ENLACE}>Ir a perfiles</Link>}
        />
      </>
    );
  }

  return <SelectorDeCurso anioId={app.anio.id} anioLectivo={app.anio.anio} />;
}

function SelectorDeCurso({ anioId, anioLectivo }: { anioId: string; anioLectivo: number }) {
  const navegar = useNavigate();
  const recurso = useRecurso(() => listarCursos(anioId), [anioId]);
  const [elegido, setElegido] = useState('');

  if (recurso.error instanceof ErrorAcceso) return <SinPermiso />;

  const cursos = recurso.datos;

  return (
    <>
      <Encabezado
        titulo="Estudiantes"
        descripcion={`Año lectivo ${anioLectivo}. Elige un curso para ver y registrar sus estudiantes.`}
      />

      {recurso.error ? <Aviso tipo="error">{mensajeError(recurso.error)}</Aviso> : null}
      {recurso.cargando && !cursos ? <Cargando /> : null}

      {cursos && cursos.length === 0 ? (
        <EstadoVacio
          titulo="No hay cursos en este año"
          descripcion="Crea un curso antes de registrar estudiantes."
          accion={<Link to="/cursos" className={ENLACE}>Ir a cursos</Link>}
        />
      ) : null}

      {cursos && cursos.length > 0 ? (
        <Tarjeta titulo="Curso">
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-start"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (elegido !== '') navegar(`/estudiantes/${elegido}`);
            }}
          >
            <Campo label="Curso">
              <Seleccion value={elegido} onChange={(ev) => setElegido(ev.target.value)}>
                <option value="">Elige un curso</option>
                {cursos.map((curso) => (
                  <option key={curso.id} value={curso.id}>
                    {curso.grado} {curso.grupo}
                  </option>
                ))}
              </Seleccion>
            </Campo>
            <Boton type="submit" className="sm:mt-6" disabled={elegido === ''}>
              Ver estudiantes
            </Boton>
          </form>
        </Tarjeta>
      ) : null}
    </>
  );
}
