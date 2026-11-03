import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Aviso, Boton, Campo, Cargando, Encabezado, Entrada, Insignia, Pestanas, SinPermiso, Tarjeta,
  aplicarErroresCampos, mensajeError, useConfirmacion, useRecurso,
} from '@/ui';
import { useApp } from '@/layout/ContextoApp';
import { ErrorAcceso } from '@/core/errores';
import type { Perfil } from '@/core/tipos';
import * as servicio from '@/modules/perfiles/perfiles.servicio';
import { EscalaPerfil } from './EscalaPerfil';
import { AprobacionPerfil } from './AprobacionPerfil';

type Pestana = 'general' | 'escala' | 'aprobacion' | 'asistencia';

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'general', etiqueta: 'General' },
  { id: 'escala', etiqueta: 'Escala' },
  { id: 'aprobacion', etiqueta: 'Aprobación y niveles' },
  { id: 'asistencia', etiqueta: 'Asistencia' },
];

interface Props {
  perfil: Perfil;
  onCambio: () => Promise<void>;
}

const esquemaNombre = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre de la institución.'),
});
type FormularioNombre = z.infer<typeof esquemaNombre>;

/** Pestaña General: nombre, activo o inactivo, y eliminación con resumen. */
function GeneralPerfil({ perfil, onCambio }: Props) {
  const app = useApp();
  const navegar = useNavigate();
  const { pedir, dialogo } = useConfirmacion();
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const inactivo = !perfil.activo;

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<FormularioNombre>({
    resolver: zodResolver(esquemaNombre),
    defaultValues: { nombre: perfil.nombre },
  });

  useEffect(() => {
    reset({ nombre: perfil.nombre });
  }, [perfil.nombre, reset]);

  async function guardarNombre(v: FormularioNombre) {
    setAviso(null);
    try {
      await servicio.renombrarPerfil(perfil.id, v.nombre);
      setAviso({ tipo: 'exito', texto: 'Nombre actualizado.' });
      await onCambio();
    } catch (e) {
      if (!aplicarErroresCampos(e, setError)) setAviso({ tipo: 'error', texto: mensajeError(e) });
    }
  }

  async function alternarActivo() {
    setAviso(null);
    try {
      await servicio.cambiarActivo(perfil.id, !perfil.activo);
      setAviso({
        tipo: 'exito',
        texto: perfil.activo
          ? 'El perfil está inactivo: queda en solo consulta. Puedes reactivarlo cuando quieras.'
          : 'El perfil está activo de nuevo.',
      });
      await onCambio();
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeError(e) });
    }
  }

  async function eliminar() {
    setAviso(null);
    try {
      const lineas = await servicio.resumenEliminarPerfil(perfil.id);
      const confirmado = await pedir({
        titulo: `Eliminar el perfil "${perfil.nombre}"`,
        mensaje: 'Se borrará todo lo siguiente. Esta acción no se puede deshacer.',
        lineas,
        textoConfirmar: 'Eliminar perfil',
        peligro: true,
      });
      if (!confirmado) return;
      await servicio.eliminarPerfil(perfil.id);
      navegar('/perfiles', { replace: true });
      await app.recargar();
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeError(e) });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {aviso ? <Aviso tipo={aviso.tipo === 'exito' ? 'exito' : 'error'}>{aviso.texto}</Aviso> : null}

      <Tarjeta titulo="Datos del perfil">
        <form noValidate onSubmit={handleSubmit(guardarNombre)} className="flex flex-col gap-4">
          <fieldset disabled={inactivo} className="flex flex-col gap-4">
            <Campo label="Nombre de la institución" error={errors.nombre?.message}>
              <Entrada type="text" autoComplete="off" {...register('nombre')} />
            </Campo>
            <div>
              <Boton type="submit">Guardar nombre</Boton>
            </div>
          </fieldset>
        </form>
      </Tarjeta>

      <Tarjeta titulo="Estado">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Insignia tono={perfil.activo ? 'exito' : 'neutro'} className="self-start">
              {perfil.activo ? 'Activo' : 'Inactivo'}
            </Insignia>
            <p className="text-sm text-slate-600">
              Un perfil inactivo conserva su historial y queda en solo consulta. Se puede reactivar.
            </p>
          </div>
          <Boton variant={perfil.activo ? 'secundario' : 'primario'} onClick={() => void alternarActivo()}>
            {perfil.activo ? 'Marcar como inactivo' : 'Reactivar perfil'}
          </Boton>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Eliminar perfil">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Elimina el perfil con todos sus años lectivos, periodos, cursos, notas y calendario.
          </p>
          <Boton variant="peligro" onClick={() => void eliminar()}>Eliminar perfil</Boton>
        </div>
      </Tarjeta>

      {dialogo}
    </div>
  );
}

/** Pestaña Asistencia: solo configuración; este prototipo no registra asistencia. */
function AsistenciaPerfil({ perfil, onCambio }: Props) {
  const [valor, setValor] = useState(perfil.asistenciaObligatoria);
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const inactivo = !perfil.activo;

  useEffect(() => {
    setValor(perfil.asistenciaObligatoria);
  }, [perfil.asistenciaObligatoria]);

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAviso(null);
    try {
      await servicio.guardarAsistencia(perfil.id, valor);
      setAviso({ tipo: 'exito', texto: 'Configuración de asistencia guardada.' });
      await onCambio();
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeError(err) });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {aviso ? <Aviso tipo={aviso.tipo === 'exito' ? 'exito' : 'error'}>{aviso.texto}</Aviso> : null}
      <Tarjeta titulo="Asistencia">
        <form onSubmit={(e) => void guardar(e)} className="flex flex-col gap-4">
          <fieldset disabled={inactivo} className="flex flex-col gap-4">
            <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-slate-400 text-teal-700"
                checked={valor}
                onChange={(e) => setValor(e.target.checked)}
              />
              La asistencia es obligatoria en esta institución
            </label>
            <p className="text-sm text-slate-600">
              Solo es configuración: en este prototipo no se registra asistencia.
            </p>
            <div>
              <Boton type="submit">Guardar</Boton>
            </div>
          </fieldset>
        </form>
      </Tarjeta>
    </div>
  );
}

/** Detalle de un perfil: /perfiles/:perfilId. Las reglas de la ruta mandan sobre el selector. */
export function PerfilDetallePagina() {
  const { perfilId = '' } = useParams();
  const app = useApp();
  const [pestana, setPestana] = useState<Pestana>('general');

  const { datos, cargando, error, recargar } = useRecurso(async () => {
    const perfil = await servicio.obtenerPerfil(perfilId);
    const reglas = await servicio.estadoReglas(perfilId);
    return { perfil, reglas };
  }, [perfilId]);

  const perfil = datos?.perfil ?? null;
  const idEnSelector = app.perfil?.id;

  useEffect(() => {
    if (perfil && perfil.id !== idEnSelector) {
      void app.sincronizar(perfil.id, null);
    }
    // Solo reacciona al perfil del recurso y al seleccionado.
  }, [perfil?.id, idEnSelector]);

  if (cargando && !datos) return <Cargando />;
  if (error) {
    if (error instanceof ErrorAcceso) return <SinPermiso />;
    return <Aviso tipo="error">{mensajeError(error)}</Aviso>;
  }
  if (!datos || !perfil) return null;

  const { reglas } = datos;
  const inactivo = !perfil.activo;
  const bloqueoEscala = inactivo
    ? 'Perfil inactivo: solo consulta.'
    : reglas.conCierres
      ? 'Hay periodos finalizados en este perfil: no se pueden cambiar la escala, los decimales, la nota para aprobar ni los niveles nacionales.'
      : null;

  async function tras(): Promise<void> {
    await recargar();
    await app.recargar();
  }

  return (
    <>
      <Encabezado
        titulo={perfil.nombre}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <Insignia tono={perfil.activo ? 'exito' : 'neutro'}>{perfil.activo ? 'Activo' : 'Inactivo'}</Insignia>
            {reglas.conNotas ? <span>Tiene notas registradas.</span> : null}
          </span>
        }
        acciones={
          <Link
            to="/perfiles"
            className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Volver a perfiles
          </Link>
        }
      />

      {inactivo ? (
        <Aviso tipo="advertencia" className="mb-4">
          Perfil inactivo: solo consulta. Puedes reactivarlo en la pestaña General.
        </Aviso>
      ) : null}

      <div className="mb-4">
        <Pestanas
          etiqueta="Secciones del perfil"
          items={PESTANAS}
          activa={pestana}
          onCambiar={(id) => setPestana(id as Pestana)}
        />
      </div>

      <div role="tabpanel" aria-label={PESTANAS.find((p) => p.id === pestana)?.etiqueta}>
        {pestana === 'general' ? <GeneralPerfil perfil={perfil} onCambio={tras} /> : null}
        {pestana === 'escala' ? (
          <EscalaPerfil
            perfil={perfil}
            conNotas={reglas.conNotas}
            motivoBloqueo={bloqueoEscala}
            onGuardado={tras}
          />
        ) : null}
        {pestana === 'aprobacion' ? (
          <AprobacionPerfil
            perfil={perfil}
            motivoBloqueo={bloqueoEscala}
            onGuardado={tras}
          />
        ) : null}
        {pestana === 'asistencia' ? <AsistenciaPerfil perfil={perfil} onCambio={tras} /> : null}
      </div>
    </>
  );
}
