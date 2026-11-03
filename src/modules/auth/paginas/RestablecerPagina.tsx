import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Aviso, Boton, Campo, Cargando, Encabezado, Entrada, aplicarErroresCampos, mensajeError } from '@/ui';
import * as auth from '@/modules/auth/auth.servicio';

const esquema = z
  .object({
    nueva: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirmar: z.string().min(1, 'Repite la contraseña.'),
  })
  .refine((datos) => datos.nueva === datos.confirmar, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmar'],
  });
type Valores = z.infer<typeof esquema>;

type Estado = 'verificando' | 'valido' | 'invalido' | 'listo';

const ENLACE =
  'inline-flex min-h-10 items-center font-medium text-teal-800 underline underline-offset-2 hover:text-teal-900';
const BOTON_ENLACE =
  'inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100';

export function RestablecerPagina() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [estado, setEstado] = useState<Estado>('verificando');
  const [aviso, setAviso] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { nueva: '', confirmar: '' },
  });

  useEffect(() => {
    let vigente = true;
    setEstado('verificando');
    // Sin token, validarToken devuelve false.
    auth.validarToken(token).then(
      (ok) => {
        if (vigente) setEstado(ok ? 'valido' : 'invalido');
      },
      () => {
        if (vigente) setEstado('invalido');
      },
    );
    return () => {
      vigente = false;
    };
  }, [token]);

  async function enviar(valores: Valores) {
    setAviso(null);
    try {
      await auth.restablecerContrasena(token, valores.nueva);
      setEstado('listo');
    } catch (e) {
      if (aplicarErroresCampos(e, setError)) return;
      setAviso(mensajeError(e));
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Encabezado titulo="Restablecer contraseña" descripcion="Crea una nueva contraseña para tu cuenta." />

      {estado === 'verificando' ? <Cargando texto="Verificando el enlace…" /> : null}

      {estado === 'invalido' ? (
        <div className="flex flex-col gap-4">
          <Aviso tipo="error" titulo="El enlace no es válido">
            <p>El enlace ya se usó, venció o está incompleto. Pide uno nuevo.</p>
          </Aviso>
          <Link to="/recuperar" className={BOTON_ENLACE}>
            Pedir un enlace nuevo
          </Link>
        </div>
      ) : null}

      {estado === 'valido' ? (
        <div className="flex flex-col gap-4">
          {aviso ? <Aviso tipo="error">{aviso}</Aviso> : null}
          <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
            <Campo label="Nueva contraseña" error={errors.nueva?.message} hint="Mínimo 8 caracteres.">
              <Entrada type="password" autoComplete="new-password" {...register('nueva')} />
            </Campo>
            <Campo label="Repite la nueva contraseña" error={errors.confirmar?.message}>
              <Entrada type="password" autoComplete="new-password" {...register('confirmar')} />
            </Campo>
            <Boton type="submit" disabled={isSubmitting} className="w-full">
              Guardar contraseña
            </Boton>
          </form>
        </div>
      ) : null}

      {estado === 'listo' ? (
        <div className="flex flex-col gap-4">
          <Aviso tipo="exito" titulo="Contraseña actualizada">
            <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
          </Aviso>
          <Link to="/iniciar-sesion" className={ENLACE}>
            Ir a iniciar sesión
          </Link>
        </div>
      ) : null}
    </div>
  );
}
