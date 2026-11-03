import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Actividad, Grupo } from '@/core/tipos';
import { GRUPOS, NOMBRE_GRUPO } from '@/core/tipos';
import {
  Aviso, Boton, Campo, Entrada, Seleccion, aplicarErroresCampos, mensajeError,
} from '@/ui';
import { actualizarActividad, crearActividad } from '@/modules/evaluacion/evaluacion.servicio';

function esGrupo(valor: string): valor is Grupo {
  return (GRUPOS as string[]).includes(valor);
}

// El esquema conserva el tipo string (el select arranca vacío); el predicado solo estrecha al enviar.
const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre de la actividad.'),
  grupo: z.string().refine((valor: string): boolean => esGrupo(valor), 'Elige un grupo.'),
});
type Valores = z.infer<typeof esquema>;

export interface FormularioActividadProps {
  asignacionId: string;
  periodoId: string;
  /** Actividad a editar; null para crear una nueva. Cambiar de actividad reinicia el formulario (usar key). */
  actividad: Actividad | null;
  onCancelar: () => void;
  onGuardado: () => void;
}

export function FormularioActividad({
  asignacionId, periodoId, actividad, onCancelar, onGuardado,
}: FormularioActividadProps) {
  const {
    register, handleSubmit, setError, reset, formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { nombre: actividad?.nombre ?? '', grupo: actividad?.grupo ?? '' },
  });
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(valores: Valores) {
    setAviso(null);
    if (!esGrupo(valores.grupo)) return;
    try {
      if (actividad) {
        await actualizarActividad(actividad.id, { nombre: valores.nombre, grupo: valores.grupo });
      } else {
        await crearActividad(asignacionId, periodoId, { nombre: valores.nombre, grupo: valores.grupo });
      }
      reset({ nombre: '', grupo: '' });
      onGuardado();
    } catch (e) {
      if (!aplicarErroresCampos(e, setError)) setAviso(mensajeError(e));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
      {aviso ? <Aviso tipo="error">{aviso}</Aviso> : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <Campo label="Nombre de la actividad" error={errors.nombre?.message}>
          <Entrada {...register('nombre')} />
        </Campo>
        <Campo label="Grupo" error={errors.grupo?.message}>
          <Seleccion {...register('grupo')}>
            <option value="">Elige un grupo</option>
            {GRUPOS.map((g) => (
              <option key={g} value={g}>{NOMBRE_GRUPO[g]}</option>
            ))}
          </Seleccion>
        </Campo>
      </div>
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" disabled={isSubmitting}>
          {actividad ? 'Guardar cambios' : 'Agregar actividad'}
        </Boton>
        {actividad ? (
          <Boton variant="secundario" onClick={onCancelar}>Cancelar edición</Boton>
        ) : null}
      </div>
    </form>
  );
}
