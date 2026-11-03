import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Aviso, Boton, Campo, Cargando, Encabezado, Entrada, EstadoVacio, Insignia, SinPermiso, Tarjeta,
  aplicarErroresCampos, fechaLarga, mensajeError, useConfirmacion, useRecurso,
} from '@/ui';
import { useApp } from '@/layout/ContextoApp';
import { ErrorAcceso } from '@/core/errores';
import type { Periodo } from '@/core/tipos';
import { aNumero, CERO, type Fraccion } from '@/modules/evaluacion/fraccion';
import { pesosDePeriodos } from '@/modules/evaluacion/calculo';
import * as periodos from '@/modules/periodos/periodos.servicio';
import * as anios from '@/modules/anios/anios.servicio';
import { ConfiguracionPeriodos } from './ConfiguracionPeriodos';
import { textoPorcentaje } from './numeros';

type DatosPeriodo = periodos.DatosPeriodo;

const esquemaFechas = z.object({
  fechaInicio: z.string().min(1, 'Escribe la fecha de inicio.'),
  fechaFin: z.string().min(1, 'Escribe la fecha de fin.'),
});
type FormularioFechas = z.infer<typeof esquemaFechas>;

interface FormularioPeriodoProps {
  inicial: DatosPeriodo;
  textoEnviar: string;
  deshabilitado: boolean;
  /** Vacía los campos tras un envío correcto (solo al crear). */
  reiniciarAlGuardar: boolean;
  onEnviar: (datos: DatosPeriodo) => Promise<void>;
  onCancelar?: () => void;
}

/** Fechas de un periodo: alta y edición. Los errores del servicio (cruces, rango) se muestran aquí. */
function FormularioPeriodo({
  inicial, textoEnviar, deshabilitado, reiniciarAlGuardar, onEnviar, onCancelar,
}: FormularioPeriodoProps) {
  const [aviso, setAviso] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<FormularioFechas>({
    resolver: zodResolver(esquemaFechas),
    defaultValues: inicial,
  });

  async function enviar(v: FormularioFechas) {
    setAviso(null);
    try {
      await onEnviar({ fechaInicio: v.fechaInicio, fechaFin: v.fechaFin });
      if (reiniciarAlGuardar) reset({ fechaInicio: '', fechaFin: '' });
    } catch (e) {
      if (!aplicarErroresCampos(e, setError)) setAviso(mensajeError(e));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
      {aviso ? <Aviso tipo="error">{aviso}</Aviso> : null}
      <fieldset disabled={deshabilitado} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Fecha de inicio" error={errors.fechaInicio?.message}>
            <Entrada type="date" {...register('fechaInicio')} />
          </Campo>
          <Campo label="Fecha de fin" error={errors.fechaFin?.message}>
            <Entrada type="date" {...register('fechaFin')} />
          </Campo>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton type="submit">{textoEnviar}</Boton>
          {onCancelar ? <Boton variant="secundario" onClick={onCancelar}>Cancelar</Boton> : null}
        </div>
      </fieldset>
    </form>
  );
}

function pesoDe(anio: { modoPesoPeriodos: string }, p: Periodo, pesos: Record<string, Fraccion>): string {
  if (anio.modoPesoPeriodos === 'varian' && p.peso === undefined) return 'Sin peso';
  const f = pesos[p.id] ?? CERO;
  return textoPorcentaje(aNumero(f));
}

/** Periodos del año seleccionado: toda la lógica pasa por los servicios. */
export function PeriodosPagina() {
  const app = useApp();
  if (!app.perfil || !app.anio) {
    return (
      <>
        <Encabezado titulo="Periodos" />
        <EstadoVacio
          titulo="No hay un año lectivo seleccionado"
          descripcion="Crea un perfil para empezar: se crea con el año lectivo actual."
          accion={
            <Link
              to="/perfiles"
              className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              Ir a perfiles
            </Link>
          }
        />
      </>
    );
  }
  return <PeriodosDelAnio key={app.anio.id} anioId={app.anio.id} soloLectura={app.soloLectura} />;
}

interface PropsDelAnio {
  anioId: string;
  soloLectura: boolean;
}

function PeriodosDelAnio({ anioId, soloLectura }: PropsDelAnio) {
  const app = useApp();
  const { datos, cargando, error, recargar } = useRecurso(async () => {
    const [anio, lista, conCierre, problemas] = await Promise.all([
      anios.obtenerAnio(anioId),
      periodos.listarPeriodos(anioId),
      periodos.periodosConCierre(anioId),
      periodos.problemasDelAnio(anioId),
    ]);
    return { anio, lista, conCierre, problemas };
  }, [anioId]);
  const { pedir, dialogo } = useConfirmacion();
  const [editando, setEditando] = useState<Periodo | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  async function tras(): Promise<void> {
    await recargar();
    await app.recargar();
  }

  if (cargando && !datos) return <Cargando />;
  if (error) {
    if (error instanceof ErrorAcceso) return <SinPermiso />;
    return <Aviso tipo="error">{mensajeError(error)}</Aviso>;
  }
  if (!datos) return null;

  const { anio, lista, conCierre, problemas } = datos;
  const finalizados = new Set(conCierre);
  const estructuraBloqueada = conCierre.length > 0;
  const bloqueado = soloLectura || estructuraBloqueada;
  const pesos = pesosDePeriodos(anio, lista);
  const nombresFinalizados = lista
    .map((p, i) => ({ p, n: i + 1 }))
    .filter(({ p }) => finalizados.has(p.id))
    .map(({ n }) => `Periodo ${n}`);

  async function crear(datosNuevos: DatosPeriodo) {
    setAviso(null);
    await periodos.crearPeriodo(anioId, datosNuevos);
    setAviso({ tipo: 'exito', texto: 'Periodo agregado.' });
    await tras();
  }

  async function actualizar(datosNuevos: DatosPeriodo) {
    if (!editando) return;
    setAviso(null);
    await periodos.actualizarPeriodo(editando.id, datosNuevos);
    setEditando(null);
    setAviso({ tipo: 'exito', texto: 'Fechas del periodo actualizadas.' });
    await tras();
  }

  async function eliminar(p: Periodo, n: number) {
    setAviso(null);
    try {
      const lineas = await periodos.resumenEliminarPeriodo(p.id);
      const confirmado = await pedir({
        titulo: `Eliminar el Periodo ${n}`,
        mensaje: 'Se borrará lo siguiente. Esta acción no se puede deshacer.',
        lineas,
        textoConfirmar: 'Eliminar periodo',
        peligro: true,
      });
      if (!confirmado) return;
      await periodos.eliminarPeriodo(p.id);
      if (editando?.id === p.id) setEditando(null);
      setAviso({ tipo: 'exito', texto: `Periodo ${n} eliminado.` });
      await tras();
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeError(e) });
    }
  }

  const indiceEditando = editando ? lista.findIndex((p) => p.id === editando.id) : -1;

  return (
    <>
      <Encabezado
        titulo="Periodos"
        descripcion={`${app.perfil?.nombre ?? ''} · Año lectivo ${anio.anio}`}
      />

      <div className="flex flex-col gap-4">
        {aviso ? <Aviso tipo={aviso.tipo === 'exito' ? 'exito' : 'error'}>{aviso.texto}</Aviso> : null}

        {estructuraBloqueada ? (
          <Aviso tipo="advertencia" titulo="Hay periodos finalizados">
            Este año tiene periodos finalizados en alguna materia: no se pueden agregar ni quitar periodos, ni cambiar
            pesos o porcentajes. Los periodos finalizados tampoco cambian de fechas; los periodos abiertos sí.
            Finalizados: {nombresFinalizados.join(', ')}.
          </Aviso>
        ) : null}

        {problemas.length > 0 ? (
          <Aviso tipo="advertencia" titulo="Configuración pendiente">
            <ul className="list-disc pl-5">
              {problemas.map((texto) => (
                <li key={texto}>{texto}</li>
              ))}
            </ul>
          </Aviso>
        ) : null}

        <Tarjeta titulo="Periodos del año">
          {lista.length === 0 ? (
            <EstadoVacio titulo="Este año no tiene periodos" descripcion="Agrega el primero con el formulario de abajo." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <caption className="sr-only">Periodos del año lectivo, ordenados por fecha</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th scope="col" className="px-3 py-2 font-medium">Periodo</th>
                    <th scope="col" className="px-3 py-2 font-medium">Inicio</th>
                    <th scope="col" className="px-3 py-2 font-medium">Fin</th>
                    <th scope="col" className="px-3 py-2 font-medium">Peso efectivo</th>
                    <th scope="col" className="px-3 py-2 font-medium">Estado</th>
                    <th scope="col" className="px-3 py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p, i) => {
                    const n = i + 1;
                    const finalizado = finalizados.has(p.id);
                    return (
                      <tr key={p.id} className="border-b border-slate-100 align-top">
                        <th scope="row" className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">
                          Periodo {n}
                        </th>
                        <td className="px-3 py-3 text-slate-800">{fechaLarga(p.fechaInicio)}</td>
                        <td className="px-3 py-3 text-slate-800">{fechaLarga(p.fechaFin)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-800">{pesoDe(anio, p, pesos)}</td>
                        <td className="px-3 py-3">
                          {finalizado ? <Insignia tono="info">Finalizado</Insignia> : <span className="text-slate-500">Abierto</span>}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Boton
                              variant="fantasma"
                              disabled={soloLectura || finalizado}
                              aria-label={`Editar fechas del Periodo ${n}`}
                              onClick={() => {
                                setAviso(null);
                                setEditando(p);
                              }}
                            >
                              Editar
                            </Boton>
                            <Boton
                              variant="secundario"
                              disabled={bloqueado}
                              aria-label={`Eliminar el Periodo ${n}`}
                              onClick={() => void eliminar(p, n)}
                            >
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

        {editando && indiceEditando >= 0 ? (
          <Tarjeta titulo={`Editar fechas del Periodo ${indiceEditando + 1}`}>
            <FormularioPeriodo
              key={editando.id}
              inicial={{ fechaInicio: editando.fechaInicio, fechaFin: editando.fechaFin }}
              textoEnviar="Guardar fechas"
              deshabilitado={soloLectura || finalizados.has(editando.id)}
              reiniciarAlGuardar={false}
              onEnviar={actualizar}
              onCancelar={() => setEditando(null)}
            />
          </Tarjeta>
        ) : (
          <Tarjeta titulo="Agregar periodo">
            <p className="mb-3 text-sm text-slate-600">
              El número del periodo sale del orden de sus fechas: el más temprano es el Periodo 1. Los periodos no
              pueden cruzarse entre sí.
            </p>
            <FormularioPeriodo
              inicial={{ fechaInicio: '', fechaFin: '' }}
              textoEnviar="Agregar periodo"
              deshabilitado={bloqueado}
              reiniciarAlGuardar
              onEnviar={crear}
            />
          </Tarjeta>
        )}

        <ConfiguracionPeriodos
          anio={anio}
          periodos={lista}
          bloqueado={bloqueado}
          onGuardado={tras}
        />
      </div>

      {dialogo}
    </>
  );
}
