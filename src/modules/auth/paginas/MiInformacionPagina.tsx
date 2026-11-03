import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Aviso, Boton, Campo, Cargando, Encabezado, Entrada, Tarjeta, aplicarErroresCampos, mensajeError, useRecurso,
} from '@/ui';
import { hoy } from '@/core/reloj';
import type { Usuario } from '@/core/tipos';
import { useApp } from '@/layout/ContextoApp';
import * as auth from '@/modules/auth/auth.servicio';

const esquema = z.object({
  nombreCompleto: z.string().trim().min(1, 'Escribe tu nombre completo.'),
  fechaNacimiento: z
    .string()
    .min(1, 'Escribe tu fecha de nacimiento.')
    .refine((fecha) => fecha <= hoy(), 'La fecha de nacimiento no puede ser futura.'),
  niveles: z.array(z.enum(['primaria', 'secundaria'])).min(1, 'Elige al menos un nivel que dictas.'),
  telefono: z.string().trim(),
});
type Valores = z.infer<typeof esquema>;

const OPCIONES_NIVEL: { valor: 'primaria' | 'secundaria'; etiqueta: string }[] = [
  { valor: 'primaria', etiqueta: 'Primaria' },
  { valor: 'secundaria', etiqueta: 'Secundaria' },
];

export function MiInformacionPagina() {
  const { datos, cargando, error } = useRecurso(() => auth.usuarioActual(), []);

  if (cargando && datos === null) return <Cargando />;
  if (error) {
    return (
      <div className="flex flex-col gap-5">
        <Encabezado titulo="Mi información" />
        <Aviso tipo="error">{mensajeError(error)}</Aviso>
      </div>
    );
  }
  if (datos === null) {
    return (
      <div className="flex flex-col gap-5">
        <Encabezado titulo="Mi información" />
        <Aviso tipo="error">No se encontró tu cuenta. Vuelve a iniciar sesión.</Aviso>
      </div>
    );
  }
  return <FormularioInformacion usuario={datos} />;
}

function FormularioInformacion({ usuario }: { usuario: Usuario }) {
  const app = useApp();
  const [aviso, setAviso] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);
  const {
    register, handleSubmit, setError, formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombreCompleto: usuario.nombreCompleto,
      fechaNacimiento: usuario.fechaNacimiento ?? '',
      niveles: usuario.niveles,
      telefono: usuario.telefono ?? '',
    },
  });

  async function guardar(valores: Valores) {
    setAviso(null);
    try {
      await auth.actualizarMiInformacion({
        nombreCompleto: valores.nombreCompleto,
        fechaNacimiento: valores.fechaNacimiento,
        niveles: valores.niveles,
        telefono: valores.telefono,
      });
      setAviso({ tipo: 'exito', texto: 'Tus datos se guardaron.' });
      // Actualiza el nombre que muestra la barra superior.
      await app.recargar();
    } catch (e) {
      if (!aplicarErroresCampos(e, setError)) setAviso({ tipo: 'error', texto: mensajeError(e) });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Encabezado titulo="Mi información" descripcion="Datos previos del docente." />

      {aviso ? <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso> : null}

      <Tarjeta>
        <form noValidate onSubmit={handleSubmit(guardar)} className="flex flex-col gap-4">
          <Campo label="Nombre completo" error={errors.nombreCompleto?.message}>
            <Entrada autoComplete="name" {...register('nombreCompleto')} />
          </Campo>

          <Campo label="Correo" hint="El correo no se puede cambiar.">
            <Entrada type="email" value={usuario.correo} disabled readOnly />
          </Campo>

          <Campo label="Fecha de nacimiento" error={errors.fechaNacimiento?.message}>
            <Entrada type="date" max={hoy()} {...register('fechaNacimiento')} />
          </Campo>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-slate-800">Niveles que dictas</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {OPCIONES_NIVEL.map((opcion) => (
                <label key={opcion.valor} className="inline-flex min-h-10 items-center gap-2 text-base text-slate-900">
                  <input
                    type="checkbox"
                    value={opcion.valor}
                    className="h-5 w-5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                    {...register('niveles')}
                  />
                  {opcion.etiqueta}
                </label>
              ))}
            </div>
            {errors.niveles?.message ? (
              <p className="text-sm text-red-700">{errors.niveles.message}</p>
            ) : null}
          </fieldset>

          <Campo label="Teléfono (opcional)">
            <Entrada type="tel" autoComplete="tel" {...register('telefono')} />
          </Campo>

          <div>
            <Boton type="submit" disabled={isSubmitting}>
              Guardar cambios
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  );
}
