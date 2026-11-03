import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Aviso, Boton, Campo, Encabezado, Entrada, aplicarErroresCampos, mensajeError } from '@/ui';
import * as auth from '@/modules/auth/auth.servicio';

const esquema = z.object({
  nombreCompleto: z.string().trim().min(1, 'Escribe tu nombre completo.'),
  correo: z.string().trim().min(1, 'Escribe tu correo.').email('Escribe un correo válido.'),
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});
type Valores = z.infer<typeof esquema>;

const ENLACE =
  'inline-flex min-h-10 items-center font-medium text-teal-800 underline underline-offset-2 hover:text-teal-900';

export function RegistroPagina() {
  const navegar = useNavigate();
  const {
    register, handleSubmit, setError, formState: { errors, isSubmitting }, reset,
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { nombreCompleto: '', correo: '', contrasena: '' },
  });
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(valores: Valores) {
    setAviso(null);
    try {
      await auth.registrar(valores);
      reset();
      // No inicia sesión: lleva al inicio de sesión con el aviso de éxito.
      navegar('/iniciar-sesion', { replace: true, state: { registrado: true } });
    } catch (e) {
      if (!aplicarErroresCampos(e, setError)) setAviso(mensajeError(e));
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Encabezado titulo="Crear cuenta" descripcion="Regístrate como docente. Después podrás iniciar sesión." />

      <div className="flex flex-col gap-4">
        {aviso ? <Aviso tipo="error">{aviso}</Aviso> : null}

        <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
          <Campo label="Nombre completo" error={errors.nombreCompleto?.message}>
            <Entrada autoComplete="name" {...register('nombreCompleto')} />
          </Campo>
          <Campo label="Correo" error={errors.correo?.message}>
            <Entrada type="email" autoComplete="email" {...register('correo')} />
          </Campo>
          <Campo
            label="Contraseña"
            error={errors.contrasena?.message}
            hint="Mínimo 8 caracteres."
          >
            <Entrada type="password" autoComplete="new-password" {...register('contrasena')} />
          </Campo>
          <Boton type="submit" disabled={isSubmitting} className="w-full">
            Crear cuenta
          </Boton>
        </form>

        <Link to="/iniciar-sesion" className={ENLACE}>
          ¿Ya tienes cuenta? Inicia sesión
        </Link>
      </div>
    </div>
  );
}
