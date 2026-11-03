import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Aviso, Boton, Campo, Cargando, Encabezado, EstadoVacio, Seleccion, SinPermiso, Tarjeta, mensajeError, useRecurso,
} from '@/ui';
import { ErrorAcceso } from '@/core/errores';
import type { Periodo } from '@/core/tipos';
import { useApp } from '@/layout/ContextoApp';
import { listarAsignaciones, type AsignacionDetalle } from '@/modules/materias/materias.servicio';
import { listarPeriodos } from '@/modules/periodos/periodos.servicio';
import { etiquetaAsignacion, etiquetaPeriodo, fechaCorta } from './comun';
import { erroresPendientes } from './erroresNota';

const esquema = z.object({
  asignacionId: z.string().min(1, 'Elige una asignación.'),
  periodoId: z.string().min(1, 'Elige un periodo.'),
});
type Valores = z.infer<typeof esquema>;

interface SelectorProps {
  asignaciones: AsignacionDetalle[];
  periodos: Periodo[];
}

function SelectorPlanilla({ asignaciones, periodos }: SelectorProps) {
  const navegar = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { asignacionId: '', periodoId: '' },
  });

  function enviar(valores: Valores) {
    navegar(`/planilla/${valores.asignacionId}/${valores.periodoId}`);
  }

  return (
    <Tarjeta titulo="Elegir planilla">
      <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
        <Campo label="Materia y curso" error={errors.asignacionId?.message}>
          <Seleccion {...register('asignacionId')}>
            <option value="">Elige una asignación</option>
            {asignaciones.map((d) => (
              <option key={d.asignacion.id} value={d.asignacion.id}>{etiquetaAsignacion(d)}</option>
            ))}
          </Seleccion>
        </Campo>
        <Campo label="Periodo" error={errors.periodoId?.message}>
          <Seleccion {...register('periodoId')}>
            <option value="">Elige un periodo</option>
            {periodos.map((p, i) => (
              <option key={p.id} value={p.id}>
                {etiquetaPeriodo(i + 1)} · {fechaCorta(p.fechaInicio)} – {fechaCorta(p.fechaFin)}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <div>
          <Boton type="submit">Abrir planilla</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

export function PlanillaPagina() {
  const app = useApp();
  const anioId = app.anio?.id ?? null;
  const recurso = useRecurso(async () => {
    if (!anioId) return null;
    const [asignaciones, periodos] = await Promise.all([listarAsignaciones(anioId), listarPeriodos(anioId)]);
    return { asignaciones, periodos };
  }, [anioId]);

  const pendientes = erroresPendientes();

  let contenido: ReactNode;
  if (app.cargando) {
    contenido = <Cargando />;
  } else if (!app.anio) {
    contenido = (
      <EstadoVacio
        titulo="Aún no hay un año lectivo"
        descripcion="Crea un perfil de institución para empezar."
        accion={<Link to="/perfiles" className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">Ir a perfiles</Link>}
      />
    );
  } else if (recurso.error instanceof ErrorAcceso) {
    contenido = <SinPermiso />;
  } else if (recurso.error) {
    contenido = <Aviso tipo="error">{mensajeError(recurso.error)}</Aviso>;
  } else if (!recurso.datos) {
    contenido = <Cargando />;
  } else if (recurso.datos.asignaciones.length === 0) {
    contenido = (
      <EstadoVacio
        titulo="No tienes materias asignadas en este año"
        descripcion="Asigna materias a tus cursos para poder registrar notas."
        accion={<Link to="/materias" className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">Ir a materias y carga</Link>}
      />
    );
  } else if (recurso.datos.periodos.length === 0) {
    contenido = (
      <EstadoVacio
        titulo="El año no tiene periodos"
        descripcion="Agrega los periodos del año para poder abrir una planilla."
        accion={<Link to="/periodos" className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">Ir a periodos</Link>}
      />
    );
  } else {
    contenido = <SelectorPlanilla asignaciones={recurso.datos.asignaciones} periodos={recurso.datos.periodos} />;
  }

  return (
    <>
      <Encabezado
        titulo="Planilla"
        descripcion="Elige una materia y un periodo para registrar notas."
      />
      <div className="flex flex-col gap-4">
        {pendientes.length > 0 ? (
          <Aviso tipo="advertencia" titulo="Tienes notas que no se guardaron">
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {pendientes.map((p, i) => (
                <li key={`pendiente-${i}`}>
                  <Link to={p.ruta} className="font-medium underline underline-offset-2">{p.etiqueta}</Link>: {p.mensaje}
                </li>
              ))}
            </ul>
          </Aviso>
        ) : null}
        {contenido}
      </div>
    </>
  );
}
