import { Link } from 'react-router-dom';
import {
  Aviso, Cargando, Encabezado, EstadoVacio, SinPermiso, Tarjeta, fechaLarga, mensajeError, useRecurso,
} from '@/ui';
import { ErrorAcceso } from '@/core/errores';
import type { Periodo } from '@/core/tipos';
import { hoy } from '@/core/reloj';
import { useApp } from '@/layout/ContextoApp';
import { resumenCarga, type ResumenCarga } from '@/modules/anios/anios.servicio';
import { listarPeriodos, problemasDelAnio } from '@/modules/periodos/periodos.servicio';
import { numeroPeriodo } from '@/modules/periodos/validaciones';

interface DatosPanel {
  periodos: Periodo[];
  resumen: ResumenCarga;
  problemas: string[];
}

const ENLACE_BOTON =
  'inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100';
const ENLACE =
  'inline-flex min-h-10 items-center font-medium text-teal-800 underline underline-offset-2 hover:text-teal-900';

export function PanelPagina() {
  const app = useApp();
  const { perfil, anio } = app;
  const anioId = anio?.id ?? null;

  const { datos, cargando, error, recargar } = useRecurso<DatosPanel | null>(async () => {
    if (anioId === null) return null;
    const [periodos, resumen, problemas] = await Promise.all([
      listarPeriodos(anioId),
      resumenCarga(anioId),
      problemasDelAnio(anioId),
    ]);
    return { periodos, resumen, problemas };
  }, [anioId]);

  if (!perfil) {
    return (
      <div className="flex flex-col gap-5">
        <Encabezado titulo="Panel" />
        <EstadoVacio
          titulo="Aún no tienes perfiles de institución"
          descripcion="Crea un perfil para empezar a registrar años, periodos, cursos y notas."
          accion={
            <Link to="/perfiles" className={ENLACE_BOTON}>
              Ir a perfiles
            </Link>
          }
        />
      </div>
    );
  }

  if (!anio) {
    return (
      <div className="flex flex-col gap-5">
        <Encabezado titulo="Panel" descripcion={perfil.nombre} />
        <EstadoVacio
          titulo="Este perfil no tiene años lectivos"
          descripcion="Revisa el perfil para continuar."
          accion={
            <Link to="/perfiles" className={ENLACE_BOTON}>
              Ir a perfiles
            </Link>
          }
        />
      </div>
    );
  }

  const encabezado = (
    <Encabezado titulo="Panel" descripcion={`${perfil.nombre} · Año lectivo ${anio.anio}`} />
  );

  if (error) {
    if (error instanceof ErrorAcceso) return <SinPermiso />;
    return (
      <div className="flex flex-col gap-5">
        {encabezado}
        <Aviso tipo="error">{mensajeError(error)}</Aviso>
        <div>
          <button type="button" onClick={recargar} className={ENLACE_BOTON}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Mientras carga un año distinto no se muestran datos del anterior.
  if (cargando || datos === null) {
    return (
      <div className="flex flex-col gap-5">
        {encabezado}
        <Cargando />
      </div>
    );
  }

  const { periodos, resumen, problemas } = datos;
  const h = hoy();
  const enCurso = periodos.find((p) => p.fechaInicio <= h && h <= p.fechaFin) ?? null;

  return (
    <div className="flex flex-col gap-5">
      {encabezado}

      <Tarjeta titulo="Periodo en curso">
        {periodos.length === 0 ? (
          <p className="text-sm text-slate-700">El año no tiene periodos todavía.</p>
        ) : enCurso ? (
          <div className="flex flex-col gap-2 text-sm text-slate-800">
            <p>
              Periodo {numeroPeriodo(enCurso.id, periodos)} de {periodos.length}: del{' '}
              {fechaLarga(enCurso.fechaInicio)} al {fechaLarga(enCurso.fechaFin)}.
            </p>
            <p>
              <span className="font-medium">Fecha de cierre:</span> {fechaLarga(enCurso.fechaFin)}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm text-slate-800">
            <p>Hoy no estás dentro de ningún periodo.</p>
            <p>
              <span className="font-medium">Fecha de cierre:</span> no hay un periodo en curso.
            </p>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Carga académica">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato etiqueta="Cursos" valor={resumen.cursos} />
          <Dato etiqueta="Materias" valor={resumen.materias} />
          <Dato etiqueta="Combinaciones curso–materia" valor={resumen.asignaciones} />
          <Dato etiqueta="Estudiantes" valor={resumen.estudiantes} />
        </dl>
      </Tarjeta>

      {problemas.length > 0 ? (
        <Aviso tipo="advertencia" titulo="Configuración pendiente">
          <ul className="list-disc space-y-1 pl-5">
            {problemas.map((problema) => (
              <li key={problema}>{problema}</li>
            ))}
          </ul>
          <Link to="/periodos" className={`${ENLACE} mt-2`}>
            Revisar periodos
          </Link>
        </Aviso>
      ) : (
        <Aviso tipo="exito">La configuración de periodos del año está completa.</Aviso>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-600">{etiqueta}</dt>
      <dd className="text-xl font-semibold text-slate-900">{valor}</dd>
    </div>
  );
}
