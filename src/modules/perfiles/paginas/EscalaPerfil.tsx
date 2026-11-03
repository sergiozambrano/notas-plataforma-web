import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Aviso, Boton, Campo, Entrada, Seleccion, Tarjeta, mensajeError, useConfirmacion,
} from '@/ui';
import { ErrorAdvertencia, ErrorValidacion } from '@/core/errores';
import type { Escala, Perfil } from '@/core/tipos';
import * as servicio from '@/modules/perfiles/perfiles.servicio';
import { formatoNumero } from '@/modules/evaluacion/notas';
import { leerDecimal, textoEntrada } from './entradas';

const esquemaEscala = z.object({
  tipo: z.enum(['numerica', 'letras']),
  notaMin: z.string(),
  notaMax: z.string(),
  decimales: z.enum(['1', '2']),
  letras: z.array(z.object({ letra: z.string(), equivalente: z.string() })),
}).superRefine((v, ctx) => {
  if (v.tipo === 'numerica') {
    if (leerDecimal(v.notaMin) === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['notaMin'], message: 'Escribe un número, por ejemplo 0,0.' });
    }
    if (leerDecimal(v.notaMax) === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['notaMax'], message: 'Escribe un número, por ejemplo 5,0.' });
    }
    return;
  }
  v.letras.forEach((l, i) => {
    if (l.letra.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['letras', i, 'letra'], message: 'Escribe la letra.' });
    }
    if (leerDecimal(l.equivalente) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['letras', i, 'equivalente'],
        message: 'Escribe el equivalente numérico, por ejemplo 4,5.',
      });
    }
  });
});
type Formulario = z.infer<typeof esquemaEscala>;

const CAMPOS_NUMERICOS = ['notaMin', 'notaMax', 'decimales'] as const;
type CampoNumerico = (typeof CAMPOS_NUMERICOS)[number];

function esCampoNumerico(campo: string): campo is CampoNumerico {
  return (CAMPOS_NUMERICOS as readonly string[]).includes(campo);
}

function valoresIniciales(perfil: Perfil): Formulario {
  const e = perfil.escala;
  if (e.tipo === 'numerica') {
    return {
      tipo: 'numerica',
      notaMin: textoEntrada(e.notaMin),
      notaMax: textoEntrada(e.notaMax),
      decimales: String(e.decimales) as '1' | '2',
      letras: [],
    };
  }
  return {
    tipo: 'letras',
    notaMin: '0',
    notaMax: '5',
    decimales: '2',
    letras: [...e.letras]
      .sort((a, b) => b.equivalente - a.equivalente)
      .map((l) => ({ letra: l.letra, equivalente: textoEntrada(l.equivalente) })),
  };
}

function construirEscala(v: Formulario): Escala {
  if (v.tipo === 'numerica') {
    return {
      tipo: 'numerica',
      notaMin: leerDecimal(v.notaMin) ?? NaN,
      notaMax: leerDecimal(v.notaMax) ?? NaN,
      decimales: v.decimales === '1' ? 1 : 2,
    };
  }
  return {
    tipo: 'letras',
    letras: v.letras.map((l) => ({ letra: l.letra.trim(), equivalente: leerDecimal(l.equivalente) ?? NaN })),
  };
}

interface Props {
  perfil: Perfil;
  conNotas: boolean;
  /** Si no es null, la escala no se puede cambiar y este texto lo explica. */
  motivoBloqueo: string | null;
  onGuardado: () => Promise<void>;
}

/** Pestaña Escala: numérica (mín, máx, decimales) o por letras (lista editable, vista previa). */
export function EscalaPerfil({ perfil, conNotas, motivoBloqueo, onGuardado }: Props) {
  const { pedir, dialogo } = useConfirmacion();
  const [exito, setExito] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const bloqueado = motivoBloqueo !== null;

  const { register, control, handleSubmit, reset, watch, setError, formState: { errors } } = useForm<Formulario>({
    resolver: zodResolver(esquemaEscala),
    defaultValues: valoresIniciales(perfil),
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'letras' });

  // Al cambiar la escala guardada (tras recargar), el formulario muestra la nueva.
  const firma = JSON.stringify(perfil.escala);
  useEffect(() => {
    reset(valoresIniciales(perfil));
  }, [firma]);

  const tipo = watch('tipo');
  const letrasActuales = watch('letras');
  const vista = letrasActuales
    .flatMap((l) => {
      const equivalente = leerDecimal(l.equivalente);
      return l.letra.trim() !== '' && equivalente !== null
        ? [{ letra: l.letra.trim(), equivalente }]
        : [];
    })
    .sort((a, b) => b.equivalente - a.equivalente);

  async function guardar(v: Formulario) {
    setExito(null);
    setErrorGeneral(null);
    const escala = construirEscala(v);
    try {
      let mensaje: string | null;
      try {
        mensaje = await servicio.guardarEscala(perfil.id, escala);
      } catch (e) {
        if (!(e instanceof ErrorAdvertencia)) throw e;
        const confirmado = await pedir({
          titulo: 'Cambiar la escala',
          mensaje: e.message,
          textoConfirmar: 'Cambiar escala',
          peligro: true,
        });
        if (!confirmado) return;
        mensaje = await servicio.guardarEscala(perfil.id, escala, { confirmado: true });
      }
      setExito(mensaje ? `Escala guardada. ${mensaje}` : 'Escala guardada.');
      await onGuardado();
    } catch (e) {
      if (e instanceof ErrorValidacion) {
        const generales: string[] = [];
        for (const [campo, mensajeCampo] of Object.entries(e.campos)) {
          if (esCampoNumerico(campo)) setError(campo, { type: 'server', message: mensajeCampo });
          else generales.push(mensajeCampo);
        }
        setErrorGeneral(generales.length > 0 ? generales.join(' ') : null);
      } else {
        setErrorGeneral(mensajeError(e));
      }
    }
  }

  const errorLetras = errors.letras as { message?: string } | undefined;

  return (
    <div className="flex flex-col gap-4">
      {motivoBloqueo ? <Aviso tipo="advertencia">{motivoBloqueo}</Aviso> : null}
      {!motivoBloqueo && conNotas ? (
        <Aviso tipo="info">
          Este perfil tiene notas registradas. Si cambias la escala, las notas que no quepan en la nueva se
          borrarán; te pediremos confirmación antes.
        </Aviso>
      ) : null}
      {exito ? <Aviso tipo="exito">{exito}</Aviso> : null}
      {errorGeneral ? <Aviso tipo="error">{errorGeneral}</Aviso> : null}

      <Tarjeta titulo="Escala de calificación">
        <form noValidate onSubmit={handleSubmit(guardar)} className="flex flex-col gap-5">
          <fieldset disabled={bloqueado} className="flex flex-col gap-5">
            <legend className="mb-2 text-sm font-medium text-slate-800">Tipo de escala</legend>
            <div role="radiogroup" aria-label="Tipo de escala" className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-800">
                <input type="radio" value="numerica" className="h-4 w-4 text-teal-700" {...register('tipo')} />
                Numérica
              </label>
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-800">
                <input type="radio" value="letras" className="h-4 w-4 text-teal-700" {...register('tipo')} />
                Por letras
              </label>
            </div>

            {tipo === 'numerica' ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Campo label="Nota mínima" error={errors.notaMin?.message}>
                  <Entrada type="text" inputMode="decimal" {...register('notaMin')} />
                </Campo>
                <Campo label="Nota máxima" error={errors.notaMax?.message}>
                  <Entrada type="text" inputMode="decimal" {...register('notaMax')} />
                </Campo>
                <Campo
                  label="Decimales"
                  error={errors.decimales?.message}
                  hint="Cuántos decimales tienen las notas y los resultados."
                >
                  <Seleccion {...register('decimales')}>
                    <option value="1">1 decimal</option>
                    <option value="2">2 decimales</option>
                  </Seleccion>
                </Campo>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-slate-600">
                  Escribe las letras de mayor a menor equivalente: la pantalla las mostrará en ese orden. La nota
                  máxima es el equivalente más alto.
                </p>
                {fields.length === 0 ? (
                  <p className="text-sm text-slate-600">Aún no hay letras. Agrega la primera.</p>
                ) : null}
                <ul className="flex flex-col gap-3">
                  {fields.map((campo, indice) => (
                    <li key={campo.id} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <Campo label={`Letra ${indice + 1}`} error={errors.letras?.[indice]?.letra?.message}>
                        <Entrada type="text" autoComplete="off" {...register(`letras.${indice}.letra`)} />
                      </Campo>
                      <Campo label="Equivalente numérico" error={errors.letras?.[indice]?.equivalente?.message}>
                        <Entrada type="text" inputMode="decimal" {...register(`letras.${indice}.equivalente`)} />
                      </Campo>
                      <Boton variant="secundario" onClick={() => remove(indice)}>
                        Quitar letra {indice + 1}
                      </Boton>
                    </li>
                  ))}
                </ul>
                {errorLetras?.message ? <p className="text-sm text-red-700">{errorLetras.message}</p> : null}
                <div>
                  <Boton variant="secundario" onClick={() => append({ letra: '', equivalente: '' })}>
                    Agregar letra
                  </Boton>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-800">Vista previa (de mayor a menor)</p>
                  {vista.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-600">Completa una letra y su equivalente para verla.</p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {vista.map((l) => (
                        <li
                          key={`${l.letra}-${l.equivalente}`}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                        >
                          <span className="font-semibold">{l.letra}</span> = {formatoNumero(l.equivalente, 2)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <div>
              <Boton type="submit">Guardar escala</Boton>
            </div>
          </fieldset>
        </form>
      </Tarjeta>

      {dialogo}
    </div>
  );
}
