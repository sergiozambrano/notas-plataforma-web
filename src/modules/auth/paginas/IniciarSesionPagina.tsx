import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Aviso, Boton, Campo, Cargando, Encabezado, Entrada, Tarjeta, mensajeError, useConfirmacion,
} from '@/ui';
import * as auth from '@/modules/auth/auth.servicio';

const esquema = z.object({
  correo: z.string().trim().min(1, 'Escribe tu correo.').email('Escribe un correo válido.'),
  contrasena: z.string().min(1, 'Escribe tu contraseña.'),
});
type Valores = z.infer<typeof esquema>;

interface Mensaje {
  tipo: 'error' | 'exito';
  titulo?: string;
  contenido: ReactNode;
}

interface EstadoRuta {
  registrado?: boolean;
}

const ENLACE =
  'inline-flex min-h-10 items-center font-medium text-teal-800 underline underline-offset-2 hover:text-teal-900';

export function IniciarSesionPagina() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const { pedir, dialogo } = useConfirmacion();
  const [comprobando, setComprobando] = useState(true);
  const [conSesion, setConSesion] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  // Aviso de registro exitoso llegado por location.state; se limpia de la URL tras leerlo.
  const [registrado] = useState<boolean>(() => (ubicacion.state as EstadoRuta | null)?.registrado === true);

  const {
    register, handleSubmit, setValue, formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { correo: '', contrasena: '' },
  });

  useEffect(() => {
    if ((ubicacion.state as EstadoRuta | null)?.registrado === true) {
      navegar(ubicacion.pathname, { replace: true, state: null });
    }
    // Solo al montar: la lectura inicial ya quedó en `registrado`.
  }, []);

  useEffect(() => {
    let vigente = true;
    void auth.usuarioActual().then((usuario) => {
      if (!vigente) return;
      setConSesion(usuario !== null);
      setComprobando(false);
    });
    return () => {
      vigente = false;
    };
  }, []);

  if (comprobando) return <Cargando />;
  if (conSesion) return <Navigate to="/panel" replace />;

  async function enviar(valores: Valores) {
    setMensaje(null);
    try {
      const resultado = await auth.iniciarSesion(valores.correo, valores.contrasena);
      if (resultado.ok) {
        navegar('/panel', { replace: true });
        return;
      }
      setValue('contrasena', '');
      if (resultado.tipo === 'bloqueada') {
        setMensaje({
          tipo: 'error',
          titulo: 'Cuenta bloqueada',
          contenido: (
            <>
              <p>
                Tu cuenta está bloqueada por demasiados intentos fallidos. Restablece tu contraseña para
                desbloquearla.
              </p>
              <Link to="/recuperar" className={`${ENLACE} mt-1`}>
                Recuperar contraseña
              </Link>
            </>
          ),
        });
      } else {
        const restantes = resultado.intentosRestantes;
        setMensaje({
          tipo: 'error',
          titulo: 'Credenciales incorrectas',
          contenido: restantes === 1 ? 'Te queda 1 intento.' : `Te quedan ${restantes} intentos.`,
        });
      }
    } catch (e) {
      setMensaje({ tipo: 'error', contenido: mensajeError(e) });
    }
  }

  async function restablecerDemo() {
    const confirmado = await pedir({
      titulo: 'Restablecer datos de demostración',
      mensaje:
        'Se borrarán todos los datos guardados en este navegador (cuentas, perfiles, periodos y notas) y se cargarán de nuevo los datos de demostración.',
      textoConfirmar: 'Restablecer',
      peligro: true,
    });
    if (!confirmado) return;
    setMensaje(null);
    try {
      await auth.restablecerDemo();
      setMensaje({ tipo: 'exito', contenido: 'Los datos de demostración se restablecieron.' });
    } catch (e) {
      setMensaje({ tipo: 'error', contenido: mensajeError(e) });
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Encabezado titulo="Iniciar sesión" descripcion="Entra con tu correo y contraseña." />

      <div className="flex flex-col gap-4">
        {registrado ? (
          <Aviso tipo="exito">Cuenta creada. Ya puedes iniciar sesión.</Aviso>
        ) : null}

        {mensaje ? (
          <Aviso tipo={mensaje.tipo} titulo={mensaje.titulo}>
            {mensaje.contenido}
          </Aviso>
        ) : null}

        <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
          <Campo label="Correo" error={errors.correo?.message}>
            <Entrada type="email" autoComplete="email" {...register('correo')} />
          </Campo>
          <Campo label="Contraseña" error={errors.contrasena?.message}>
            <Entrada type="password" autoComplete="current-password" {...register('contrasena')} />
          </Campo>
          <Boton type="submit" disabled={isSubmitting} className="w-full">
            Iniciar sesión
          </Boton>
        </form>

        <nav aria-label="Otras opciones" className="flex flex-col gap-1 text-sm">
          <Link to="/registro" className={ENLACE}>
            Crear cuenta
          </Link>
          <Link to="/recuperar" className={ENLACE}>
            Recuperar contraseña
          </Link>
          <Link to="/bandeja" className={ENLACE}>
            Bandeja de correo (simulada)
          </Link>
        </nav>

        <Tarjeta titulo="Credenciales de demostración">
          <ul className="flex flex-col gap-2 text-sm text-slate-700">
            <li>
              Docente con datos completos: <span className="font-medium text-slate-900">demo@gestionnotas.co</span>
              {' · '}contraseña <span className="font-medium text-slate-900">Demo1234</span>
            </li>
            <li>
              Docente de prueba (HU-21): <span className="font-medium text-slate-900">docente2@gestionnotas.co</span>
              {' · '}contraseña <span className="font-medium text-slate-900">Demo1234</span>
            </li>
          </ul>
          <div className="mt-4">
            <Boton variant="secundario" onClick={() => void restablecerDemo()} className="w-full">
              Restablecer datos de demostración
            </Boton>
          </div>
        </Tarjeta>
      </div>
      {dialogo}
    </div>
  );
}
