import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Aviso, Boton, Campo, Cargando, Encabezado, Entrada, EstadoVacio, Insignia, Tarjeta,
  aplicarErroresCampos, mensajeError, useConfirmacion, useRecurso,
} from '@/ui';
import { useApp } from '@/layout/ContextoApp';
import { anioActual } from '@/core/reloj';
import type { Perfil } from '@/core/tipos';
import * as servicio from '@/modules/perfiles/perfiles.servicio';

const esquemaNuevo = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre de la institución.'),
});
type FormularioNuevo = z.infer<typeof esquemaNuevo>;

/** Lista de perfiles: crear, elegir, activar o desactivar, eliminar y abrir el detalle. */
export function PerfilesPagina() {
  const app = useApp();
  const { datos, cargando, error, recargar } = useRecurso(() => servicio.listarPerfiles(), []);
  const { pedir, dialogo } = useConfirmacion();
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<FormularioNuevo>({
    resolver: zodResolver(esquemaNuevo),
    defaultValues: { nombre: '' },
  });

  async function tras(): Promise<void> {
    await recargar();
    await app.recargar();
  }

  async function crear(v: FormularioNuevo) {
    setAviso(null);
    try {
      const perfil = await servicio.crearPerfil(v.nombre);
      reset({ nombre: '' });
      setAviso({ tipo: 'exito', texto: `Perfil "${perfil.nombre}" creado con su año lectivo ${anioActual()}.` });
      await tras();
    } catch (e) {
      if (!aplicarErroresCampos(e, setError)) setAviso({ tipo: 'error', texto: mensajeError(e) });
    }
  }

  async function alternarActivo(p: Perfil) {
    setAviso(null);
    try {
      await servicio.cambiarActivo(p.id, !p.activo);
      setAviso({
        tipo: 'exito',
        texto: p.activo
          ? `"${p.nombre}" está inactivo: conserva su historial en solo consulta.`
          : `"${p.nombre}" está activo de nuevo.`,
      });
      await tras();
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeError(e) });
    }
  }

  async function elegir(p: Perfil) {
    setAviso(null);
    try {
      await app.seleccionarPerfil(p.id);
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeError(e) });
    }
  }

  async function eliminar(p: Perfil) {
    setAviso(null);
    try {
      const lineas = await servicio.resumenEliminarPerfil(p.id);
      const confirmado = await pedir({
        titulo: `Eliminar el perfil "${p.nombre}"`,
        mensaje: 'Se borrará todo lo siguiente. Esta acción no se puede deshacer.',
        lineas,
        textoConfirmar: 'Eliminar perfil',
        peligro: true,
      });
      if (!confirmado) return;
      await servicio.eliminarPerfil(p.id);
      setAviso({ tipo: 'exito', texto: `Perfil "${p.nombre}" eliminado.` });
      await tras();
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeError(e) });
    }
  }

  if (cargando && !datos) return <Cargando />;
  if (error) return <Aviso tipo="error">{mensajeError(error)}</Aviso>;
  const perfiles = datos ?? [];

  return (
    <>
      <Encabezado
        titulo="Perfiles"
        descripcion="Cada perfil guarda las reglas de una institución. Elige el que quieres usar en el resto de la aplicación."
      />

      {aviso ? <Aviso tipo={aviso.tipo === 'exito' ? 'exito' : 'error'}>{aviso.texto}</Aviso> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tarjeta titulo={`Mis perfiles (${perfiles.length})`}>
            {perfiles.length === 0 ? (
              <EstadoVacio
                titulo="Aún no tienes perfiles"
                descripcion="Crea el primero con el formulario de al lado."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-slate-200">
                {perfiles.map((p) => {
                  const enUso = app.perfil?.id === p.id;
                  return (
                    <li key={p.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="break-words font-medium text-slate-900">{p.nombre}</span>
                        <div className="flex flex-wrap gap-2">
                          <Insignia tono={p.activo ? 'exito' : 'neutro'}>{p.activo ? 'Activo' : 'Inactivo'}</Insignia>
                          {enUso ? <Insignia tono="info">En uso</Insignia> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Boton
                          variant="secundario"
                          disabled={enUso}
                          onClick={() => void elegir(p)}
                        >
                          {enUso ? 'Perfil en uso' : 'Elegir'}
                        </Boton>
                        <Link
                          to={`/perfiles/${p.id}`}
                          className="inline-flex min-h-10 items-center rounded-md px-4 py-2 text-sm font-medium text-teal-800 hover:bg-slate-100"
                        >
                          Ver detalle
                        </Link>
                        <Boton variant="secundario" onClick={() => void alternarActivo(p)}>
                          {p.activo ? 'Marcar inactivo' : 'Reactivar'}
                        </Boton>
                        <Boton variant="peligro" onClick={() => void eliminar(p)}>
                          Eliminar
                        </Boton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Tarjeta>
        </div>

        <Tarjeta titulo="Nuevo perfil">
          <form noValidate onSubmit={handleSubmit(crear)} className="flex flex-col gap-4">
            <Campo
              label="Nombre de la institución"
              error={errors.nombre?.message}
              hint="Ejemplo: Institución Educativa Santa María. No puede repetirse entre tus perfiles."
            >
              <Entrada type="text" autoComplete="off" {...register('nombre')} />
            </Campo>
            <Boton type="submit">Crear perfil</Boton>
          </form>
        </Tarjeta>
      </div>

      {dialogo}
    </>
  );
}
