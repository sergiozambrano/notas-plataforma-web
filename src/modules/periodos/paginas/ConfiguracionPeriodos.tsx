import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Aviso, Boton, Campo, Entrada, Tarjeta, mensajeError } from '@/ui';
import { ErrorValidacion } from '@/core/errores';
import type { AnioLectivo, Periodo, PorcentajesGrupos } from '@/core/tipos';
import { aNumero } from '@/modules/evaluacion/fraccion';
import { sumaEs100, sumaPorcentajes } from '@/modules/periodos/validaciones';
import * as anios from '@/modules/anios/anios.servicio';
import { leerDecimal, textoNumero, textoPorcentaje } from './numeros';

const numeroOpcional = z.string().refine(
  (t) => t.trim() === '' || leerDecimal(t) !== null,
  'Escribe un número, por ejemplo 33,3.',
);

const esquemaGrupos = z.object({ ser: numeroOpcional, saber: numeroOpcional, hacer: numeroOpcional });

const esquemaConfiguracion = z.object({
  modoPesoPeriodos: z.enum(['iguales', 'varian']),
  pesos: z.array(numeroOpcional),
  modoGrupos: z.enum(['iguales', 'varian']),
  gruposIguales: esquemaGrupos,
  grupos: z.array(esquemaGrupos),
});
type Formulario = z.infer<typeof esquemaConfiguracion>;
type TextosGrupos = Formulario['gruposIguales'];

function textosDe(g: PorcentajesGrupos | undefined): TextosGrupos {
  return {
    ser: g ? textoNumero(g.ser) : '',
    saber: g ? textoNumero(g.saber) : '',
    hacer: g ? textoNumero(g.hacer) : '',
  };
}

function valoresDe(anio: AnioLectivo, periodos: Periodo[]): Formulario {
  return {
    modoPesoPeriodos: anio.modoPesoPeriodos,
    pesos: periodos.map((p) => (p.peso === undefined ? '' : textoNumero(p.peso))),
    modoGrupos: anio.modoGrupos,
    gruposIguales: textosDe(anio.gruposIguales),
    grupos: periodos.map((p) => textosDe(p.grupos)),
  };
}

/** Porcentajes ya numéricos, o undefined si falta alguno. */
function porcentajesDe(g: TextosGrupos): PorcentajesGrupos | undefined {
  const ser = leerDecimal(g.ser);
  const saber = leerDecimal(g.saber);
  const hacer = leerDecimal(g.hacer);
  if (ser === null || saber === null || hacer === null) return undefined;
  return { ser, saber, hacer };
}

/** Suma en vivo de una lista de textos: avisa si falta algún valor o si no suma 100 %. */
function resumenSuma(textos: string[]): { texto: string; ok: boolean } {
  const nums = textos.map((t) => leerDecimal(t));
  if (nums.some((n) => n === null)) return { texto: 'Suma actual: falta algún valor.', ok: false };
  const valores = nums as number[];
  const total = textoPorcentaje(aNumero(sumaPorcentajes(valores)));
  const ok = sumaEs100(valores);
  return { texto: `Suma actual: ${total}${ok ? ' (correcto)' : ' (debe sumar 100 %)'}`, ok };
}

function TextoSuma({ textos }: { textos: string[] }) {
  const r = resumenSuma(textos);
  return (
    <p aria-live="polite" className={`text-sm font-medium ${r.ok ? 'text-teal-800' : 'text-amber-900'}`}>
      {r.texto}
    </p>
  );
}

interface Props {
  anio: AnioLectivo;
  periodos: Periodo[];
  /** Si es true, toda la sección está deshabilitada (solo consulta o periodos finalizados). */
  bloqueado: boolean;
  onGuardado: () => Promise<void>;
}

/** Secciones "Pesos" y "Ser, Saber y Hacer" del año. Se guardan juntas con guardarConfiguracion. */
export function ConfiguracionPeriodos({ anio, periodos, bloqueado, onGuardado }: Props) {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<Formulario>({
    resolver: zodResolver(esquemaConfiguracion),
    defaultValues: valoresDe(anio, periodos),
  });
  const [exito, setExito] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [erroresSeccion, setErroresSeccion] = useState<Record<string, string>>({});

  // Tras guardar y recargar, el formulario muestra lo que quedó guardado.
  const firma = JSON.stringify([
    anio.modoPesoPeriodos,
    anio.modoGrupos,
    anio.gruposIguales,
    periodos.map((p) => [p.id, p.peso, p.grupos]),
  ]);
  useEffect(() => {
    reset(valoresDe(anio, periodos));
    setErroresSeccion({});
  }, [firma]);

  const modoPesos = watch('modoPesoPeriodos');
  const modoGrupos = watch('modoGrupos');
  const pesos = watch('pesos');
  const gruposIguales = watch('gruposIguales');
  const grupos = watch('grupos');
  const cuota = periodos.length === 0 ? null : 100 / periodos.length;

  async function guardar(v: Formulario) {
    setExito(null);
    setErrorGeneral(null);
    setErroresSeccion({});
    const config = {
      modoPesoPeriodos: v.modoPesoPeriodos,
      modoGrupos: v.modoGrupos,
      gruposIguales: porcentajesDe(v.gruposIguales) ?? { ser: 0, saber: 0, hacer: 0 },
      periodos: periodos.map((p, i) => ({
        id: p.id,
        peso: leerDecimal(v.pesos[i] ?? '') ?? undefined,
        grupos: porcentajesDe(v.grupos[i] ?? { ser: '', saber: '', hacer: '' }),
      })),
    };
    try {
      await anios.guardarConfiguracion(anio.id, config);
      setExito('Configuración guardada.');
      await onGuardado();
    } catch (e) {
      if (e instanceof ErrorValidacion) setErroresSeccion(e.campos);
      else setErrorGeneral(mensajeError(e));
    }
  }

  return (
    <Tarjeta titulo="Pesos y porcentajes de Ser, Saber y Hacer">
      {exito ? <Aviso tipo="exito">{exito}</Aviso> : null}
      {errorGeneral ? <Aviso tipo="error">{errorGeneral}</Aviso> : null}

      <form noValidate onSubmit={handleSubmit(guardar)} className="mt-3 flex flex-col gap-6">
        <fieldset disabled={bloqueado} className="flex flex-col gap-6">
          <section aria-labelledby="titulo-pesos" className="flex flex-col gap-3">
            <h3 id="titulo-pesos" className="text-sm font-semibold text-slate-900">Pesos de los periodos</h3>
            <div role="radiogroup" aria-label="Pesos de los periodos" className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-800">
                <input type="radio" value="iguales" className="h-4 w-4 text-teal-700" {...register('modoPesoPeriodos')} />
                Todos los periodos pesan igual
              </label>
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-800">
                <input type="radio" value="varian" className="h-4 w-4 text-teal-700" {...register('modoPesoPeriodos')} />
                El peso varía por periodo
              </label>
            </div>

            {modoPesos === 'iguales' ? (
              <p className="text-sm text-slate-700">
                {cuota === null
                  ? 'Agrega periodos para calcular su peso.'
                  : `Cada periodo pesa ${textoPorcentaje(cuota)} (100 ÷ ${periodos.length}).`}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <ul className="grid gap-3 sm:grid-cols-2">
                  {periodos.map((p, i) => (
                    <li key={p.id}>
                      <Campo label={`Peso del Periodo ${i + 1} (%)`} error={errors.pesos?.[i]?.message}>
                        <Entrada type="text" inputMode="decimal" {...register(`pesos.${i}`)} />
                      </Campo>
                    </li>
                  ))}
                </ul>
                <TextoSuma textos={pesos} />
              </div>
            )}
            {erroresSeccion.pesos ? <Aviso tipo="error">{erroresSeccion.pesos}</Aviso> : null}
          </section>

          <section aria-labelledby="titulo-grupos" className="flex flex-col gap-3">
            <h3 id="titulo-grupos" className="text-sm font-semibold text-slate-900">Ser, Saber y Hacer</h3>
            <div
              role="radiogroup"
              aria-label="Porcentajes de Ser, Saber y Hacer"
              className="flex flex-col gap-2 sm:flex-row sm:gap-6"
            >
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-800">
                <input type="radio" value="iguales" className="h-4 w-4 text-teal-700" {...register('modoGrupos')} />
                Iguales para todos los periodos
              </label>
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-800">
                <input type="radio" value="varian" className="h-4 w-4 text-teal-700" {...register('modoGrupos')} />
                Varían por periodo
              </label>
            </div>

            {modoGrupos === 'iguales' ? (
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo label="Ser (%)" error={errors.gruposIguales?.ser?.message}>
                    <Entrada type="text" inputMode="decimal" {...register('gruposIguales.ser')} />
                  </Campo>
                  <Campo label="Saber (%)" error={errors.gruposIguales?.saber?.message}>
                    <Entrada type="text" inputMode="decimal" {...register('gruposIguales.saber')} />
                  </Campo>
                  <Campo label="Hacer (%)" error={errors.gruposIguales?.hacer?.message}>
                    <Entrada type="text" inputMode="decimal" {...register('gruposIguales.hacer')} />
                  </Campo>
                </div>
                <TextoSuma textos={[gruposIguales.ser, gruposIguales.saber, gruposIguales.hacer]} />
                {erroresSeccion.gruposIguales ? <Aviso tipo="error">{erroresSeccion.gruposIguales}</Aviso> : null}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {periodos.map((p, i) => {
                  const fila = grupos[i] ?? { ser: '', saber: '', hacer: '' };
                  return (
                    <fieldset key={p.id} className="flex flex-col gap-3 rounded-md border border-slate-200 p-3">
                      <legend className="px-1 text-sm font-medium text-slate-800">Periodo {i + 1}</legend>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Campo label="Ser (%)" error={errors.grupos?.[i]?.ser?.message}>
                          <Entrada type="text" inputMode="decimal" {...register(`grupos.${i}.ser`)} />
                        </Campo>
                        <Campo label="Saber (%)" error={errors.grupos?.[i]?.saber?.message}>
                          <Entrada type="text" inputMode="decimal" {...register(`grupos.${i}.saber`)} />
                        </Campo>
                        <Campo label="Hacer (%)" error={errors.grupos?.[i]?.hacer?.message}>
                          <Entrada type="text" inputMode="decimal" {...register(`grupos.${i}.hacer`)} />
                        </Campo>
                      </div>
                      <TextoSuma textos={[fila.ser, fila.saber, fila.hacer]} />
                    </fieldset>
                  );
                })}
                {erroresSeccion.grupos ? <Aviso tipo="error">{erroresSeccion.grupos}</Aviso> : null}
              </div>
            )}
          </section>

          <div>
            <Boton type="submit">Guardar configuración</Boton>
          </div>
        </fieldset>
      </form>
    </Tarjeta>
  );
}
