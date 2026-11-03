import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Aviso, Boton, Campo, Cargando, Encabezado, EstadoVacio, Seleccion, SinPermiso, Tarjeta, mensajeError, useRecurso,
} from '@/ui';
import { ErrorAcceso } from '@/core/errores';
import { useApp } from '@/layout/ContextoApp';
import { listarAsignaciones, type AsignacionDetalle } from '@/modules/materias/materias.servicio';
import { etiquetaAsignacion } from './comun';

const esquema = z.object({
  asignacionId: z.string().min(1, 'Elige una asignación.'),
});
type Valores = z.infer<typeof esquema>;

function SelectorDefinitivas({ asignaciones }: { asignaciones: AsignacionDetalle[] }) {
  const navegar = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { asignacionId: '' },
  });

  function enviar(valores: Valores) {
    navegar(`/definitivas/${valores.asignacionId}`);
  }

  return (
    <Tarjeta titulo="Elegir materia y curso">
      <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
        <Campo label="Materia y curso" error={errors.asignacionId?.message}>
          <Seleccion {...register('asignacionId')}>
            <option value="">Elige una asignación</option>
            {asignaciones.map((d) => (
              <option key={d.asignacion.id} value={d.asignacion.id}>{etiquetaAsignacion(d)}</option>
            ))}
          </Seleccion>
        </Campo>
        <div>
          <Boton type="submit">Ver definitivas</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

export function DefinitivasPagina() {
  const app = useApp();
  const anioId = app.anio?.id ?? null;
  const recurso = useRecurso(
    () => (anioId ? listarAsignaciones(anioId) : Promise.resolve([] as AsignacionDetalle[])),
    [anioId],
  );

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
  } else if (recurso.datos.length === 0) {
    contenido = (
      <EstadoVacio
        titulo="No tienes materias asignadas en este año"
        descripcion="Asigna materias a tus cursos para ver sus definitivas."
        accion={<Link to="/materias" className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">Ir a materias y carga</Link>}
      />
    );
  } else {
    contenido = <SelectorDefinitivas asignaciones={recurso.datos} />;
  }

  return (
    <>
      <Encabezado titulo="Definitivas" descripcion="Elige una materia y un curso para ver la nota definitiva de cada estudiante." />
      {contenido}
    </>
  );
}
