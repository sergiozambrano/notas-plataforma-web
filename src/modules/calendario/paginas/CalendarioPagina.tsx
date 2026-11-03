import { useState } from 'react';
import { Link } from 'react-router-dom';
import { addMonths, format, isAfter, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Aviso, Boton, Cargando, Encabezado, EstadoVacio, Insignia, SinPermiso, Tarjeta, fechaLarga,
  mensajeError, useConfirmacion, useRecurso, type TonoInsignia,
} from '@/ui';
import { useApp } from '@/layout/ContextoApp';
import { ErrorAcceso } from '@/core/errores';
import type { EventoCalendario, Periodo } from '@/core/tipos';
import * as calendario from '@/modules/calendario/calendario.servicio';
import * as periodos from '@/modules/periodos/periodos.servicio';
import { FormularioEvento } from './FormularioEvento';

interface ElementoMes {
  id: string;
  tipo: 'periodo' | 'vacaciones' | 'actividad';
  titulo: string;
  inicio: string;
  fin: string;
  /** Solo los eventos (vacaciones y actividades) se pueden eliminar desde aquí. */
  eventoId?: string;
}

interface GrupoMes {
  clave: string;
  etiqueta: string;
  elementos: ElementoMes[];
}

const ETIQUETA_TIPO: Record<ElementoMes['tipo'], { texto: string; tono: TonoInsignia }> = {
  periodo: { texto: 'Periodo', tono: 'info' },
  vacaciones: { texto: 'Vacaciones', tono: 'exito' },
  actividad: { texto: 'Actividad', tono: 'neutro' },
};

/** Claves 'yyyy-MM' de cada mes que toca el rango, en orden. Un evento de varios meses aparece en cada uno. */
function mesesDelRango(inicio: string, fin: string): string[] {
  const claves: string[] = [];
  const ultimo = startOfMonth(parseISO(fin));
  let cursor = startOfMonth(parseISO(inicio));
  while (!isAfter(cursor, ultimo)) {
    claves.push(format(cursor, 'yyyy-MM'));
    cursor = addMonths(cursor, 1);
  }
  return claves;
}

function etiquetaMes(clave: string): string {
  const texto = format(parseISO(`${clave}-01`), "LLLL 'de' yyyy", { locale: es });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function agruparPorMes(periodosAnio: Periodo[], eventos: EventoCalendario[]): GrupoMes[] {
  const elementos: ElementoMes[] = [
    ...periodosAnio.map((p, i) => ({
      id: `periodo-${p.id}`,
      tipo: 'periodo' as const,
      titulo: `Periodo ${i + 1}`,
      inicio: p.fechaInicio,
      fin: p.fechaFin,
    })),
    ...eventos.map((e) => ({
      id: `evento-${e.id}`,
      tipo: e.tipo,
      titulo: e.nombre,
      inicio: e.fechaInicio,
      fin: e.fechaFin,
      eventoId: e.id,
    })),
  ];

  const porMes = new Map<string, ElementoMes[]>();
  for (const el of elementos) {
    for (const clave of mesesDelRango(el.inicio, el.fin)) {
      const lista = porMes.get(clave) ?? [];
      lista.push(el);
      porMes.set(clave, lista);
    }
  }

  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, lista]) => ({
      clave,
      etiqueta: etiquetaMes(clave),
      elementos: lista.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo, 'es')),
    }));
}

function rangoTexto(inicio: string, fin: string): string {
  return inicio === fin ? fechaLarga(inicio) : `${fechaLarga(inicio)} al ${fechaLarga(fin)}`;
}

/** Calendario del año seleccionado: periodos, vacaciones y actividades en lista por mes. */
export function CalendarioPagina() {
  const app = useApp();
  if (!app.perfil || !app.anio) {
    return (
      <>
        <Encabezado titulo="Calendario" />
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
  return <CalendarioDelAnio key={app.anio.id} anioId={app.anio.id} anioNumero={app.anio.anio} perfilNombre={app.perfil.nombre} soloLectura={app.soloLectura} />;
}

interface PropsDelAnio {
  anioId: string;
  anioNumero: number;
  perfilNombre: string;
  soloLectura: boolean;
}

function CalendarioDelAnio({ anioId, anioNumero, perfilNombre, soloLectura }: PropsDelAnio) {
  const app = useApp();
  const { datos, cargando, error, recargar } = useRecurso(async () => {
    const [lista, eventos] = await Promise.all([
      periodos.listarPeriodos(anioId),
      calendario.listarEventos(anioId),
    ]);
    return { periodos: lista, eventos };
  }, [anioId]);
  const { pedir, dialogo } = useConfirmacion();
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

  const grupos = agruparPorMes(datos.periodos, datos.eventos);

  async function eliminar(e: EventoCalendario) {
    setAviso(null);
    try {
      const confirmado = await pedir({
        titulo: `Eliminar "${e.nombre}"`,
        mensaje: `Se quitará ${e.tipo === 'vacaciones' ? 'este periodo de vacaciones' : 'esta actividad'} del calendario (${rangoTexto(e.fechaInicio, e.fechaFin)}).`,
        textoConfirmar: 'Eliminar',
        peligro: true,
      });
      if (!confirmado) return;
      await calendario.eliminarEvento(e.id);
      setAviso({ tipo: 'exito', texto: `"${e.nombre}" eliminado del calendario.` });
      await tras();
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeError(err) });
    }
  }

  async function agregado(): Promise<void> {
    setAviso({ tipo: 'exito', texto: 'Agregado al calendario.' });
    await tras();
  }

  return (
    <>
      <Encabezado
        titulo="Calendario"
        descripcion={`${perfilNombre} · Año lectivo ${anioNumero}. Periodos, vacaciones y actividades por mes.`}
      />

      <div className="flex flex-col gap-4">
        {aviso ? <Aviso tipo={aviso.tipo === 'exito' ? 'exito' : 'error'}>{aviso.texto}</Aviso> : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tarjeta titulo="Calendario por mes">
              {grupos.length === 0 ? (
                <EstadoVacio
                  titulo="No hay nada en el calendario"
                  descripcion="Agrega vacaciones o actividades, o crea los periodos del año."
                />
              ) : (
                <div className="flex flex-col gap-6">
                  {grupos.map((grupo) => (
                    <section key={grupo.clave} aria-labelledby={`mes-${grupo.clave}`}>
                      <h3 id={`mes-${grupo.clave}`} className="mb-2 border-b border-slate-200 pb-1 text-base font-semibold text-teal-900">
                        {grupo.etiqueta}
                      </h3>
                      <ul className="flex flex-col divide-y divide-slate-100">
                        {grupo.elementos.map((el) => (
                          <li key={`${grupo.clave}-${el.id}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Insignia tono={ETIQUETA_TIPO[el.tipo].tono}>{ETIQUETA_TIPO[el.tipo].texto}</Insignia>
                                <span className="break-words font-medium text-slate-900">{el.titulo}</span>
                              </div>
                              <p className="text-sm text-slate-600">{rangoTexto(el.inicio, el.fin)}</p>
                            </div>
                            {el.eventoId ? (
                              <div>
                                <Boton
                                  variant="secundario"
                                  disabled={soloLectura}
                                  aria-label={`Eliminar ${el.titulo}`}
                                  onClick={() => {
                                    const evento = datos.eventos.find((x) => x.id === el.eventoId);
                                    if (evento) void eliminar(evento);
                                  }}
                                >
                                  Eliminar
                                </Boton>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </Tarjeta>
          </div>

          <div>
            <FormularioEvento anioId={anioId} deshabilitado={soloLectura} onGuardado={agregado} />
          </div>
        </div>
      </div>

      {dialogo}
    </>
  );
}
