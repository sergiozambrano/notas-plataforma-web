import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Aviso, Boton, Campo, Encabezado, Entrada, aplicarErroresCampos, mensajeError } from '@/ui';
import * as auth from '@/modules/auth/auth.servicio';

const esquema = z.object({
  correo: z.string().trim().min(1, 'Escribe tu correo.').email('Escribe un correo válido.'),
});
type Valores = z.infer<typeof esquema>;

const ENLACE =
  'inline-flex min-h-10 items-center font-medium text-teal-800 underline underline-offset-2 hover:text-teal-900';

export function RecuperarPagina() {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { correo: '' },
  });
  const [confirmado, setConfirmado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(valores: Valores) {
    setAviso(null);
    try {
      await auth.solicitarRecuperacion(valores.correo);
      // Mismo mensaje exista o no el correo: no revela si la cuenta está registrada.
      setConfirmado(true);
    } catch (e) {
      if (!aplicarErroresCampos(e, setError)) setAviso(mensajeError(e));
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Encabezado
        titulo="Recuperar contraseña"
        descripcion="Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña."
      />

      <div className="flex flex-col gap-4">
        {aviso ? <Aviso tipo="error">{aviso}</Aviso> : null}

        {confirmado ? (
          <Aviso tipo="info" titulo="Revisa tu correo">
            <p>
              Si el correo está registrado, te enviamos un enlace para restablecer la contraseña. El enlace vence
              en 1 hora.
            </p>
            <Link to="/bandeja" className={`${ENLACE} mt-2`}>
              Ir a la bandeja de correo (simulada)
            </Link>
          </Aviso>
        ) : null}

        <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
          <Campo label="Correo" error={errors.correo?.message}>
            <Entrada type="email" autoComplete="email" {...register('correo')} />
          </Campo>
          <Boton type="submit" disabled={isSubmitting} className="w-full">
            Enviar enlace
          </Boton>
        </form>

        <Link to="/iniciar-sesion" className={ENLACE}>
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
