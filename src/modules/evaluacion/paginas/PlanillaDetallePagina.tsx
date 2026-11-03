import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Aviso, Boton, Campo, Cargando, Encabezado, EstadoVacio, Insignia, Seleccion, SinPermiso, Tarjeta,
  mensajeError, useConfirmacion, useRecurso,
} from '@/ui';
import { ErrorAcceso, ErrorFinalizar, type DetalleFinalizar } from '@/core/errores';
import type { Actividad, Grupo, ValorNota } from '@/core/tipos';
import { GRUPOS, NOMBRE_GRUPO } from '@/core/tipos';
import {
  eliminarActividad, finalizarPeriodo, obtenerPlanilla, resumenEliminarActividad,
} from '@/modules/evaluacion/evaluacion.servicio';
import { NotaVisual } from './NotaVisual';
import { CeldaNota } from './CeldaNota';
import { FormularioActividad } from './FormularioActividad';
import { erroresDePlanilla, podarErroresDePlanilla } from './erroresNota';
import {
  etiquetaAsignacion, etiquetaPeriodo, fechaCorta, nombreEstudiante, rangoPeriodo,
} from './comun';
import { useSincronizar } from './useSincronizar';

type Columna = { tipo: 'actividad'; actividad: Actividad } | { tipo: 'vacia'; grupo: Grupo };

const BOTON_TEXTO = 'inline-flex min-h-10 items-center rounded-md px-2 text-sm font-medium text-teal-800 hover:bg-slate-100';

function MotivosFinalizar({ detalle }: { detalle: DetalleFinalizar }) {
  return (
    <Aviso tipo="error" titulo="No se puede finalizar el periodo todavía">
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {detalle.antesDeFecha ? (
          <li>La fecha de fin del periodo es el {fechaCorta(detalle.antesDeFecha)}. Solo se puede finalizar desde ese día.</li>
        ) : null}
        {detalle.sinEstudiantes ? <li>El curso no tiene estudiantes.</li> : null}
        {detalle.gruposSinActividades.length > 0 ? (
          <li>
            Falta al menos una actividad en: {detalle.gruposSinActividades.map((g) => NOMBRE_GRUPO[g]).join(', ')}.
          </li>
        ) : null}
        {detalle.configuracion.map((texto, i) => (
          <li key={`config-${i}`}>Configuración: {texto}</li>
        ))}
        {detalle.pendientes.length > 0 ? (
          <li>Faltan {detalle.pendientes.length} notas (ver lista abajo).</li>
        ) : null}
      </ul>
      {detalle.pendientes.length > 0 ? (
        <ul
          aria-label="Notas pendientes"
          tabIndex={0}
          className="mt-3 max-h-60 list-disc overflow-y-auto rounded-md border border-red-200 bg-white p-3 pl-7 text-slate-800"
        >
          {detalle.pendientes.map((p, i) => (
            <li key={`pendiente-${i}`}>{p.estudiante} — {p.actividad}</li>
          ))}
        </ul>
      ) : null}
    </Aviso>
  );
}

export function PlanillaDetallePagina() {
  const { asignacionId = '', periodoId = '' } = useParams();
  const navegar = useNavigate();
  const { pedir, dialogo } = useConfirmacion();
  const recurso = useRecurso(() => obtenerPlanilla(asignacionId, periodoId), [asignacionId, periodoId]);
  const planilla = recurso.datos;
  useSincronizar(planilla?.perfil.id, planilla?.anio.id);

  const [, forzar] = useState(0);
  const [estado, setEstado] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [detalleFin, setDetalleFin] = useState<DetalleFinalizar | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => {
    if (!planilla) return;
    podarErroresDePlanilla(
      asignacionId,
      periodoId,
      planilla.actividades.map((a) => a.id),
      planilla.estudiantes.map((e) => e.id),
    );
  }, [planilla, asignacionId, periodoId]);

  if (recurso.error instanceof ErrorAcceso) return <SinPermiso />;
  if (recurso.error) return <Aviso tipo="error">{mensajeError(recurso.error)}</Aviso>;
  if (!planilla) return <Cargando />;

  const escala = planilla.perfil.escala;
  const finalizado = planilla.cierre !== null;
  const editable = planilla.motivoSoloLectura === null;
  const configurando = planilla.problemas.length > 0;
  const actividadEdicion = planilla.actividades.find((a) => a.id === editandoId) ?? null;
  const errores = erroresDePlanilla(asignacionId, periodoId);

  const valores = new Map<string, ValorNota>(
    planilla.notas.map((n): [string, ValorNota] => [`${n.actividadId}|${n.estudianteId}`, n.valor]),
  );

  // Columnas en orden Ser, Saber, Hacer. Un grupo sin actividades ocupa una columna atenuada.
  const bloques = GRUPOS.map((grupo) => {
    const acts = planilla.actividades.filter((a) => a.grupo === grupo);
    const columnas: Columna[] = acts.length > 0
      ? acts.map((actividad): Columna => ({ tipo: 'actividad', actividad }))
      : [{ tipo: 'vacia', grupo }];
    return { grupo, columnas };
  });
  const columnas = bloques.flatMap((b) => b.columnas);

  async function pedirFinalizar() {
    setAviso(null);
    setDetalleFin(null);
    const confirmado = await pedir({
      titulo: `¿Finalizar el periodo ${planilla!.numeroPeriodo}?`,
      mensaje: 'Se calcularán y fijarán las notas de periodo de cada estudiante en esta materia. Después no podrás cambiar sus notas ni sus actividades.',
      textoConfirmar: 'Finalizar periodo',
    });
    if (!confirmado) return;
    setFinalizando(true);
    try {
      await finalizarPeriodo(asignacionId, periodoId);
      setEstado('Periodo finalizado.');
      recurso.recargar();
    } catch (e) {
      if (e instanceof ErrorFinalizar) setDetalleFin(e.detalle);
      else setAviso(mensajeError(e));
    } finally {
      setFinalizando(false);
    }
  }

  async function pedirEliminarActividad(actividad: Actividad) {
    setAviso(null);
    try {
      const lineas = await resumenEliminarActividad(actividad.id);
      const confirmado = await pedir({
        titulo: `¿Eliminar la actividad "${actividad.nombre}"?`,
        mensaje: 'La actividad se eliminará y no se puede deshacer.',
        lineas,
        textoConfirmar: 'Eliminar',
        peligro: true,
      });
      if (!confirmado) return;
      await eliminarActividad(actividad.id);
      if (editandoId === actividad.id) setEditandoId(null);
      recurso.recargar();
    } catch (e) {
      setAviso(mensajeError(e));
    }
  }

  function alTerminarGuardado(exito: boolean) {
    setEstado(exito ? 'Guardado' : '');
    forzar((n) => n + 1);
  }

  const acciones = finalizado ? (
    <Link
      to={`/definitivas/${asignacionId}`}
      className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
    >
      Ver definitivas
    </Link>
  ) : editable ? (
    <Boton onClick={() => void pedirFinalizar()} disabled={finalizando}>
      Finalizar periodo
    </Boton>
  ) : null;

  return (
    <>
      {dialogo}
      <Encabezado
        titulo={`${etiquetaAsignacion(planilla.asignacion)} · ${etiquetaPeriodo(planilla.numeroPeriodo)}`}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <span>{rangoPeriodo(planilla.periodo)}</span>
            {finalizado ? <Insignia tono="exito">Finalizado</Insignia> : null}
          </span>
        }
        acciones={acciones}
      />

      <div className="mb-4 max-w-xs">
        <Campo label="Cambiar de periodo">
          <Seleccion
            value={planilla.periodo.id}
            onChange={(e) => navegar(`/planilla/${asignacionId}/${e.target.value}`)}
          >
            {planilla.periodos.map((p, i) => (
              <option key={p.id} value={p.id}>
                {etiquetaPeriodo(i + 1)} · {fechaCorta(p.fechaInicio)}
              </option>
            ))}
          </Seleccion>
        </Campo>
      </div>

      <div className="flex flex-col gap-4">
        {aviso ? <Aviso tipo="error">{aviso}</Aviso> : null}

        {configurando ? (
          <Aviso tipo="advertencia" titulo="El periodo no está bien configurado">
            <p>No se pueden registrar notas hasta corregir lo siguiente:</p>
            <ul className="mt-1 list-disc pl-5">
              {planilla.problemas.map((texto, i) => (
                <li key={`problema-${i}`}>{texto}</li>
              ))}
            </ul>
            <Link to="/periodos" className="mt-2 inline-flex min-h-10 items-center font-medium text-amber-950 underline underline-offset-2">
              Ir a Periodos
            </Link>
          </Aviso>
        ) : null}

        {planilla.gruposSinActividades.length > 0 ? (
          <Aviso tipo="advertencia" titulo="Faltan actividades en algún grupo">
            <ul className="mt-1 list-disc pl-5">
              {planilla.gruposSinActividades.map((g) => (
                <li key={g}>
                  El grupo {NOMBRE_GRUPO[g]} no tiene actividades. Agrega al menos una para registrar notas en él.
                </li>
              ))}
            </ul>
          </Aviso>
        ) : null}

        {planilla.motivoSoloLectura ? <Aviso tipo="info">{planilla.motivoSoloLectura}</Aviso> : null}

        {detalleFin ? <MotivosFinalizar detalle={detalleFin} /> : null}

        {editable ? (
          <Tarjeta titulo={actividadEdicion ? 'Editar actividad' : 'Nueva actividad'}>
            <FormularioActividad
              key={actividadEdicion?.id ?? 'nueva'}
              asignacionId={asignacionId}
              periodoId={periodoId}
              actividad={actividadEdicion}
              onCancelar={() => setEditandoId(null)}
              onGuardado={() => {
                setEditandoId(null);
                setAviso(null);
                recurso.recargar();
              }}
            />
          </Tarjeta>
        ) : null}

        {planilla.estudiantes.length === 0 ? (
          <EstadoVacio
            titulo="Este curso no tiene estudiantes"
            descripcion="Registra estudiantes para poder poner notas."
            accion={
              <Link
                to={`/estudiantes/${planilla.asignacion.curso.id}`}
                className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Ir a estudiantes del curso
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    scope="col"
                    className="sticky left-0 z-20 min-w-48 border-b border-r border-slate-200 bg-white px-3 py-2 text-left font-semibold text-slate-900"
                  >
                    Estudiante
                  </th>
                  {bloques.map(({ grupo, columnas: cols }) => (
                    <th
                      key={grupo}
                      scope="colgroup"
                      colSpan={cols.length}
                      className={`border-b border-l border-slate-200 px-2 py-2 text-center font-semibold ${
                        cols[0].tipo === 'vacia' ? 'bg-slate-50 font-normal text-slate-400' : 'bg-teal-50 text-teal-900'
                      }`}
                    >
                      {NOMBRE_GRUPO[grupo]}
                    </th>
                  ))}
                  {finalizado ? (
                    <th
                      rowSpan={2}
                      scope="col"
                      className="border-b border-l border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-900"
                    >
                      Nota del periodo
                    </th>
                  ) : null}
                </tr>
                <tr>
                  {columnas.map((col) =>
                    col.tipo === 'actividad' ? (
                      <th
                        key={col.actividad.id}
                        scope="col"
                        className="min-w-36 border-b border-l border-slate-200 px-2 py-2 text-left align-top font-medium text-slate-900"
                      >
                        <div className="break-words">{col.actividad.nombre}</div>
                        {editable ? (
                          <div className="mt-1 flex gap-1">
                            <button
                              type="button"
                              aria-label={`Editar actividad ${col.actividad.nombre}`}
                              className={BOTON_TEXTO}
                              onClick={() => setEditandoId(col.actividad.id)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              aria-label={`Eliminar actividad ${col.actividad.nombre}`}
                              className={`${BOTON_TEXTO} text-red-700`}
                              onClick={() => void pedirEliminarActividad(col.actividad)}
                            >
                              Eliminar
                            </button>
                          </div>
                        ) : null}
                      </th>
                    ) : (
                      <th
                        key={`vacia-${col.grupo}`}
                        scope="col"
                        className="border-b border-l border-slate-200 bg-slate-50 px-2 py-2 text-left font-normal italic text-slate-400"
                      >
                        Sin actividades
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {planilla.estudiantes.map((estudiante) => {
                  const valorCierre: number | undefined = planilla.cierre?.notasCalculadas[estudiante.id];
                  return (
                    <tr key={estudiante.id} className="border-t border-slate-200">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 min-w-48 border-r border-slate-200 bg-white px-3 py-2 text-left font-medium text-slate-900"
                      >
                        {nombreEstudiante(estudiante)}
                      </th>
                      {columnas.map((col) =>
                        col.tipo === 'actividad' ? (
                          <td key={col.actividad.id} className="border-l border-slate-200 p-1">
                            <CeldaNota
                              asignacionId={asignacionId}
                              periodoId={periodoId}
                              actividad={col.actividad}
                              estudiante={estudiante}
                              valor={valores.get(`${col.actividad.id}|${estudiante.id}`)}
                              escala={escala}
                              deshabilitada={configurando}
                              soloLectura={!editable}
                              onResultado={alTerminarGuardado}
                            />
                          </td>
                        ) : (
                          <td key={`vacia-${col.grupo}`} aria-hidden="true" className="border-l border-slate-200 bg-slate-50" />
                        ),
                      )}
                      {finalizado ? (
                        <td className="border-l border-slate-200 bg-slate-50 px-3 py-2">
                          {valorCierre === undefined ? '—' : <NotaVisual valor={valorCierre} escala={escala} />}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p aria-live="polite" className="min-h-5 text-sm text-teal-800">{estado}</p>

        {errores.length > 0 ? (
          <Aviso tipo="error" titulo="Estas notas no se guardaron">
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {errores.map(({ clave, error }) => (
                <li key={clave}>
                  {error.etiqueta}: {error.mensaje}
                </li>
              ))}
            </ul>
          </Aviso>
        ) : null}
      </div>
    </>
  );
}
