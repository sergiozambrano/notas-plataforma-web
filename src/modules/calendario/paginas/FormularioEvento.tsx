import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Aviso, Boton, Campo, Entrada, Tarjeta, aplicarErroresCampos, mensajeError, useConfirmacion,
} from '@/ui';
import { ErrorAdvertencia } from '@/core/errores';
import * as calendario from '@/modules/calendario/calendario.servicio';

const esquemaEvento = z
  .object({
    tipo: z.enum(['vacaciones', 'actividad']),
    nombre: z.string().trim().min(1, 'Escribe un nombre.'),
    fechaInicio: z.string().min(1, 'Escribe la fecha.'),
    fechaFin: z.string(),
  })
  .refine((v) => v.tipo === 'actividad' || v.fechaFin !== '', {
    message: 'Escribe la fecha de fin.',
    path: ['fechaFin'],
  });
type Formulario = z.infer<typeof esquemaEvento>;

const VACIO: Formulario = { tipo: 'vacaciones', nombre: '', fechaInicio: '', fechaFin: '' };

interface Props {
  anioId: string;
  deshabilitado: boolean;
  onGuardado: () => Promise<void>;
}

/** Alta de vacaciones (rango) o de actividad escolar (fecha única). */
export function FormularioEvento({ anioId, deshabilitado, onGuardado }: Props) {
  const { pedir, dialogo } = useConfirmacion();
  const [aviso, setAviso] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, watch, formState: { errors } } = useForm<Formulario>({
    resolver: zodResolver(esquemaEvento),
    defaultValues: VACIO,
  });
  const esVacaciones = watch('tipo') === 'vacaciones';

  async function enviar(v: Formulario) {
    setAviso(null);
    const datos: calendario.DatosEvento = {
      tipo: v.tipo,
      nombre: v.nombre,
      fechaInicio: v.fechaInicio,
      fechaFin: v.tipo === 'vacaciones' ? v.fechaFin : v.fechaInicio,
    };
    try {
      try {
        await calendario.crearEvento(anioId, datos);
      } catch (e) {
        if (!(e instanceof ErrorAdvertencia)) throw e;
        const confirmado = await pedir({
          titulo: 'Actividad dentro de vacaciones',
          mensaje: e.message,
          textoConfirmar: 'Registrar igual',
        });
        if (!confirmado) return;
        await calendario.crearEvento(anioId, datos, { confirmado: true });
      }
      reset({ tipo: v.tipo, nombre: '', fechaInicio: '', fechaFin: '' });
      await onGuardado();
    } catch (e) {
      if (!aplicarErroresCampos(e, setError)) setAviso(mensajeError(e));
    }
  }

  return (
    <Tarjeta titulo="Agregar al calendario">
      {aviso ? <Aviso tipo="error" className="mb-3">{aviso}</Aviso> : null}
      <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
        <fieldset disabled={deshabilitado} className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Tipo de evento" className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-800">
              <input type="radio" value="vacaciones" className="h-4 w-4 text-teal-700" {...register('tipo')} />
              Vacaciones (rango de fechas)
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-800">
              <input type="radio" value="actividad" className="h-4 w-4 text-teal-700" {...register('tipo')} />
              Actividad escolar (fecha única)
            </label>
          </div>

          <Campo label="Nombre" error={errors.nombre?.message}>
            <Entrada type="text" autoComplete="off" {...register('nombre')} />
          </Campo>

          <div className={`grid gap-4 ${esVacaciones ? 'sm:grid-cols-2' : ''}`}>
            <Campo label={esVacaciones ? 'Fecha de inicio' : 'Fecha'} error={errors.fechaInicio?.message}>
              <Entrada type="date" {...register('fechaInicio')} />
            </Campo>
            {esVacaciones ? (
              <Campo label="Fecha de fin" error={errors.fechaFin?.message}>
                <Entrada type="date" {...register('fechaFin')} />
              </Campo>
            ) : null}
          </div>

          <div>
            <Boton type="submit">{esVacaciones ? 'Agregar vacaciones' : 'Agregar actividad'}</Boton>
          </div>
        </fieldset>
      </form>
      {dialogo}
    </Tarjeta>
  );
}
