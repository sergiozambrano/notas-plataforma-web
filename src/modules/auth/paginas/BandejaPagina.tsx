import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Aviso, Boton, Cargando, EstadoVacio, Encabezado, mensajeError, useRecurso } from '@/ui';
import type { CorreoSimulado } from '@/core/tipos';
import * as auth from '@/modules/auth/auth.servicio';

const ENLACE =
  'inline-flex min-h-10 items-center break-all font-medium text-teal-800 underline underline-offset-2 hover:text-teal-900';

/** Ruta interna (mismo origen) para usar con <Link>, o null si no es interna. */
function rutaInterna(enlace: string): string | null {
  try {
    const url = new URL(enlace, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function fechaEnvio(fecha: string): string {
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? fecha : format(d, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
}

function EnlaceCorreo({ enlace }: { enlace: string }) {
  const interna = rutaInterna(enlace);
  if (interna !== null) {
    return (
      <Link to={interna} className={ENLACE}>
        {enlace}
      </Link>
    );
  }
  return (
    <a href={enlace} className={ENLACE}>
      {enlace}
    </a>
  );
}

function TarjetaCorreo({ correo }: { correo: CorreoSimulado }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="font-medium text-slate-600">Para</dt>
        <dd className="min-w-0 break-all text-slate-900">{correo.para}</dd>
        <dt className="font-medium text-slate-600">Asunto</dt>
        <dd className="font-semibold text-slate-900">{correo.asunto}</dd>
        <dt className="font-medium text-slate-600">Fecha</dt>
        <dd className="text-slate-900">{fechaEnvio(correo.fecha)}</dd>
      </dl>
      <p className="mt-3 whitespace-pre-line text-sm text-slate-800">{correo.cuerpo}</p>
      <div className="mt-3 text-sm">
        <span className="font-medium text-slate-600">Enlace: </span>
        <EnlaceCorreo enlace={correo.enlace} />
      </div>
    </li>
  );
}

/** Bandeja pública donde se ven los correos simulados. Nada se envía realmente. */
export function BandejaPagina() {
  const { datos, cargando, error, recargar } = useRecurso(() => auth.listarCorreos(), []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Encabezado
        titulo="Bandeja de correo (simulada)"
        descripcion="Aquí aparecen los correos que la aplicación enviaría. No se envía nada real."
        acciones={
          <Boton variant="secundario" onClick={recargar}>
            Actualizar
          </Boton>
        }
      />

      <div className="flex flex-col gap-4">
        {error ? <Aviso tipo="error">{mensajeError(error)}</Aviso> : null}
        {cargando && datos === null ? <Cargando /> : null}

        {datos !== null && datos.length === 0 ? (
          <EstadoVacio
            titulo="No hay correos"
            descripcion="Cuando pidas restablecer tu contraseña, el correo aparecerá aquí."
            accion={
              <Link
                to="/recuperar"
                className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Recuperar contraseña
              </Link>
            }
          />
        ) : null}

        {datos !== null && datos.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {datos.map((correo) => (
              <TarjetaCorreo key={correo.id} correo={correo} />
            ))}
          </ul>
        ) : null}

        <Link
          to="/iniciar-sesion"
          className="inline-flex min-h-10 items-center font-medium text-teal-800 underline underline-offset-2 hover:text-teal-900"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
