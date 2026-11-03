import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Aviso, Boton, Campo, Entrada, Seleccion, Tarjeta, aplicarErroresCampos, mensajeError,
} from '@/ui';
import type { NivelesNacionales, Perfil } from '@/core/tipos';
import * as servicio from '@/modules/perfiles/perfiles.servicio';
import { formatoNumero } from '@/modules/evaluacion/notas';
import { notaMinima, notaMaxima, decimalesDe } from '@/modules/evaluacion/calculo';
import { leerDecimal, textoEntrada } from './entradas';

// La validación de formato y de rango la hace el servicio (por campo). Aquí solo se exige que haya texto.
const esquemaAprobacion = z.object({
  notaAprobar: z.string().trim().min(1, 'Indica la nota para aprobar.'),
  bajo: z.string(),
  basico: z.string(),
  alto: z.string(),
  superior: z.string(),
});
type Formulario = z.infer<typeof esquemaAprobacion>;

function valoresIniciales(perfil: Perfil): Formulario {
  const n = perfil.nivelesNacionales;
  return {
    notaAprobar: typeof perfil.notaAprobar === 'number'
      ? formatoNumero(perfil.notaAprobar, decimalesDe(perfil.escala))
      : perfil.notaAprobar,
    bajo: textoEntrada(n.bajo),
    basico: textoEntrada(n.basico),
    alto: textoEntrada(n.alto),
    superior: textoEntrada(n.superior),
  };
}

interface Props {
  perfil: Perfil;
  motivoBloqueo: string | null;
  onGuardado: () => Promise<void>;
}

/** Pestaña Aprobación y niveles: nota para aprobar (número o letra) y desde qué nota empieza cada nivel. */
export function AprobacionPerfil({ perfil, motivoBloqueo, onGuardado }: Props) {
  const [exito, setExito] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const bloqueado = motivoBloqueo !== null;
  const escala = perfil.escala;
  const numerica = escala.tipo === 'numerica';
  const decimales = decimalesDe(escala);
  const minimo = formatoNumero(notaMinima(escala), decimales);
  const maximo = formatoNumero(notaMaxima(escala), decimales);
  const letrasOrdenadas = escala.tipo === 'letras'
    ? [...escala.letras].sort((a, b) => b.equivalente - a.equivalente)
    : [];

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<Formulario>({
    resolver: zodResolver(esquemaAprobacion),
    defaultValues: valoresIniciales(perfil),
  });

  // Tras guardar y recargar, el formulario muestra lo que quedó guardado.
  const firma = JSON.stringify([perfil.notaAprobar, perfil.nivelesNacionales, perfil.escala]);
  useEffect(() => {
    reset(valoresIniciales(perfil));
  }, [firma]);

  async function guardar(v: Formulario) {
    setExito(null);
    setErrorGeneral(null);
    const niveles: NivelesNacionales = {
      bajo: leerDecimal(v.bajo) ?? NaN,
      basico: leerDecimal(v.basico) ?? NaN,
      alto: leerDecimal(v.alto) ?? NaN,
      superior: leerDecimal(v.superior) ?? NaN,
    };
    const notaAprobar = numerica ? (leerDecimal(v.notaAprobar) ?? NaN) : v.notaAprobar;
    try {
      await servicio.guardarAprobacion(perfil.id, notaAprobar, niveles);
      setExito('Nota para aprobar y niveles guardados.');
      await onGuardado();
    } catch (e) {
      if (!aplicarErroresCampos(e, setError)) setErrorGeneral(mensajeError(e));
    }
  }

  const nivelesCampos = [
    { nombre: 'bajo', etiqueta: 'Bajo' },
    { nombre: 'basico', etiqueta: 'Básico' },
    { nombre: 'alto', etiqueta: 'Alto' },
    { nombre: 'superior', etiqueta: 'Superior' },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      {motivoBloqueo ? <Aviso tipo="advertencia">{motivoBloqueo}</Aviso> : null}
      {exito ? <Aviso tipo="exito">{exito}</Aviso> : null}
      {errorGeneral ? <Aviso tipo="error">{errorGeneral}</Aviso> : null}

      <Tarjeta titulo="Nota para aprobar">
        <form noValidate onSubmit={handleSubmit(guardar)} className="flex flex-col gap-5">
          <fieldset disabled={bloqueado} className="flex flex-col gap-5">
            {numerica ? (
              <Campo
                label="Nota para aprobar"
                error={errors.notaAprobar?.message}
                hint={`Entre ${minimo} y ${maximo}, con máximo ${decimales} decimal${decimales === 1 ? '' : 'es'}.`}
                className="max-w-xs"
              >
                <Entrada type="text" inputMode="decimal" {...register('notaAprobar')} />
              </Campo>
            ) : (
              <Campo
                label="Letra para aprobar"
                error={errors.notaAprobar?.message}
                hint="Una letra de la escala. Su equivalente numérico se usa para decidir si aprueba."
                className="max-w-xs"
              >
                <Seleccion {...register('notaAprobar')}>
                  {letrasOrdenadas.map((l) => (
                    <option key={l.letra} value={l.letra}>
                      {l.letra} ({formatoNumero(l.equivalente, 2)})
                    </option>
                  ))}
                </Seleccion>
              </Campo>
            )}
          </fieldset>

          <fieldset disabled={bloqueado} className="flex flex-col gap-4">
            <legend className="text-sm font-semibold text-slate-900">Equivalencia nacional</legend>
            <p className="text-sm text-slate-600">
              Indica desde qué nota empieza cada nivel. Bajo es la nota mínima de la escala ({minimo}). Cada nota
              queda en un único nivel, así que los inicios deben crecer de Bajo a Superior.
              {numerica ? '' : ' En escala por letras se usan los equivalentes numéricos.'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {nivelesCampos.map((nivel) => (
                <Campo key={nivel.nombre} label={`Desde (${nivel.etiqueta})`} error={errors[nivel.nombre]?.message}>
                  <Entrada type="text" inputMode="decimal" {...register(nivel.nombre)} />
                </Campo>
              ))}
            </div>
            <div>
              <Boton type="submit">Guardar aprobación y niveles</Boton>
            </div>
          </fieldset>
        </form>
      </Tarjeta>
    </div>
  );
}
