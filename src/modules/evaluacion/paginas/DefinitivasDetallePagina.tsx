import { Link, useParams } from 'react-router-dom';
import {
  Aviso, Cargando, Encabezado, EstadoVacio, Insignia, SinPermiso, mensajeError, useRecurso,
} from '@/ui';
import { ErrorAcceso } from '@/core/errores';
import { obtenerDefinitivas } from '@/modules/evaluacion/evaluacion.servicio';
import { NotaVisual } from './NotaVisual';
import { etiquetaAsignacion, etiquetaPeriodo, nombreEstudiante, porcentajeTexto } from './comun';
import { useSincronizar } from './useSincronizar';

export function DefinitivasDetallePagina() {
  const { asignacionId = '' } = useParams();
  const recurso = useRecurso(() => obtenerDefinitivas(asignacionId), [asignacionId]);
  const datos = recurso.datos;
  useSincronizar(datos?.perfil.id, datos?.anio.id);

  if (recurso.error instanceof ErrorAcceso) return <SinPermiso />;
  if (recurso.error) return <Aviso tipo="error">{mensajeError(recurso.error)}</Aviso>;
  if (!datos) return <Cargando />;

  const escala = datos.perfil.escala;

  return (
    <>
      <Encabezado
        titulo={`Definitivas · ${etiquetaAsignacion(datos.asignacion)}`}
        descripcion="Nota de cada periodo, definitiva y aprobación de cada estudiante."
        acciones={
          <Link
            to="/definitivas"
            className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Cambiar materia
          </Link>
        }
      />

      {datos.filas.length === 0 ? (
        <EstadoVacio
          titulo="Este curso no tiene estudiantes"
          descripcion="Registra estudiantes para ver sus definitivas."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-20 min-w-48 border-b border-r border-slate-200 bg-white px-3 py-2 text-left font-semibold text-slate-900"
                >
                  Estudiante
                </th>
                {datos.periodos.map((periodo, i) => (
                  <th
                    key={periodo.id}
                    scope="col"
                    className="border-b border-l border-slate-200 px-3 py-2 text-left font-semibold text-slate-900"
                  >
                    <div>{etiquetaPeriodo(i + 1)}</div>
                    <div className="text-xs font-normal text-slate-600">Peso {porcentajeTexto(datos.pesos[i])}</div>
                    <Link
                      to={`/planilla/${datos.asignacion.asignacion.id}/${periodo.id}`}
                      className="mt-1 inline-flex min-h-10 items-center text-xs font-medium text-teal-800 underline underline-offset-2"
                    >
                      Ver planilla
                    </Link>
                  </th>
                ))}
                <th scope="col" className="border-b border-l border-slate-200 bg-teal-50 px-3 py-2 text-left font-semibold text-teal-900">
                  Definitiva
                </th>
                <th scope="col" className="border-b border-l border-slate-200 px-3 py-2 text-left font-semibold text-slate-900">
                  Nivel nacional
                </th>
                <th scope="col" className="border-b border-l border-slate-200 px-3 py-2 text-left font-semibold text-slate-900">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody>
              {datos.filas.map((fila) => (
                <tr key={fila.estudiante.id} className="border-t border-slate-200">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 min-w-48 border-r border-slate-200 bg-white px-3 py-2 text-left font-medium text-slate-900"
                  >
                    {nombreEstudiante(fila.estudiante)}
                  </th>
                  {fila.notasPeriodo.map((valor, i) => (
                    <td key={datos.periodos[i].id} className="border-l border-slate-200 px-3 py-2">
                      {valor === null ? '—' : <NotaVisual valor={valor} escala={escala} />}
                    </td>
                  ))}
                  <td className="border-l border-slate-200 bg-teal-50/40 px-3 py-2 font-medium">
                    {fila.definitiva === null ? (
                      <span className="text-amber-900">Pendiente</span>
                    ) : (
                      <NotaVisual valor={fila.definitiva} escala={escala} />
                    )}
                  </td>
                  <td className="border-l border-slate-200 px-3 py-2">{fila.nivel ?? '—'}</td>
                  <td className="border-l border-slate-200 px-3 py-2">
                    {fila.aprueba === null ? (
                      '—'
                    ) : fila.aprueba ? (
                      <Insignia tono="exito">Aprueba</Insignia>
                    ) : (
                      <Insignia tono="peligro">No aprueba</Insignia>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
