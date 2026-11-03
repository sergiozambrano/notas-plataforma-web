import type { CorreoSimulado, FechaISO, Nivel, TokenRecuperacion, Usuario } from '@/core/tipos';
import { ErrorNegocio, ErrorValidacion } from '@/core/errores';
import { borrarTodo, escribirDb, leerDb } from '@/core/almacen';
import { cerrarSesionLocal, exigirUsuarioId, iniciarSesionLocal, usuarioIdSesion } from '@/core/sesion';
import { ahoraISO, esFechaISO, hoy } from '@/core/reloj';
import { nuevoId } from '@/core/ids';
import { cargarDemo } from '@/demo/semilla';

export type ResultadoInicio =
  | { ok: true }
  | { ok: false; tipo: 'credenciales'; intentosRestantes: number }
  | { ok: false; tipo: 'bloqueada' };

const MAX_INTENTOS = 3;
const MINIMO_CONTRASENA = 8;
const VIGENCIA_TOKEN_MS = 60 * 60 * 1000;
const SAL_FICTICIA = 'sal-ficticia-para-correos-desconocidos';

function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function aHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Simulación: SHA-256 de sal + contraseña. No es seguridad real. */
export async function hashContrasena(sal: string, contrasena: string): Promise<string> {
  const datos = new TextEncoder().encode(sal + contrasena);
  return aHex(await crypto.subtle.digest('SHA-256', datos));
}

function nuevaSal(): string {
  return aHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

function vigente(token: TokenRecuperacion): boolean {
  if (token.usado) return false;
  return Date.parse(ahoraISO()) - Date.parse(token.creadoEn) < VIGENCIA_TOKEN_MS;
}

function respuestaFallo(intentos: number): ResultadoInicio {
  if (intentos >= MAX_INTENTOS) return { ok: false, tipo: 'bloqueada' };
  return { ok: false, tipo: 'credenciales', intentosRestantes: MAX_INTENTOS - intentos };
}

export async function registrar(datos: { nombreCompleto: string; correo: string; contrasena: string }): Promise<void> {
  const nombre = datos.nombreCompleto.trim();
  const correo = normalizarCorreo(datos.correo);
  const errores: Record<string, string> = {};
  if (nombre === '') errores.nombreCompleto = 'Escribe tu nombre completo.';
  if (!correoValido(correo)) errores.correo = 'Escribe un correo válido.';
  if (datos.contrasena.length < MINIMO_CONTRASENA) {
    errores.contrasena = `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.`;
  }
  if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);

  const sal = nuevaSal();
  const hash = await hashContrasena(sal, datos.contrasena);
  escribirDb((db) => {
    if (db.usuarios.some((u) => u.correo === correo)) {
      throw new ErrorValidacion({ correo: 'Ya existe una cuenta con este correo.' });
    }
    const usuario: Usuario = {
      id: nuevoId(), nombreCompleto: nombre, correo, hashContrasena: hash, sal,
      niveles: [], intentosFallidos: 0, bloqueado: false,
    };
    db.usuarios.push(usuario);
    delete db.intentosCorreoDesconocido[correo];
  });
}

export async function iniciarSesion(correo: string, contrasena: string): Promise<ResultadoInicio> {
  const clave = normalizarCorreo(correo);
  const usuarioPrevio = leerDb().usuarios.find((u) => u.correo === clave);
  if (usuarioPrevio?.bloqueado) return { ok: false, tipo: 'bloqueada' };

  const hash = await hashContrasena(usuarioPrevio?.sal ?? SAL_FICTICIA, contrasena);
  const salida: { resultado?: ResultadoInicio; usuarioId?: string } = {};

  escribirDb((db) => {
    const usuario = db.usuarios.find((u) => u.correo === clave);
    if (!usuario) {
      // Misma respuesta que una cuenta real: no revela si el correo existe.
      const intentos = (db.intentosCorreoDesconocido[clave] ?? 0) + 1;
      db.intentosCorreoDesconocido[clave] = intentos;
      salida.resultado = respuestaFallo(intentos);
      return;
    }
    if (usuario.bloqueado) {
      salida.resultado = { ok: false, tipo: 'bloqueada' };
      return;
    }
    if (usuario.hashContrasena === hash) {
      usuario.intentosFallidos = 0;
      salida.resultado = { ok: true };
      salida.usuarioId = usuario.id;
      return;
    }
    usuario.intentosFallidos += 1;
    if (usuario.intentosFallidos >= MAX_INTENTOS) usuario.bloqueado = true;
    salida.resultado = respuestaFallo(usuario.intentosFallidos);
  });

  const resultado: ResultadoInicio = salida.resultado ?? { ok: false, tipo: 'bloqueada' };
  if (resultado.ok && salida.usuarioId !== undefined) iniciarSesionLocal(salida.usuarioId);
  return resultado;
}

export async function cerrarSesion(): Promise<void> {
  cerrarSesionLocal();
}

export async function usuarioActual(): Promise<Usuario | null> {
  const id = usuarioIdSesion();
  if (id === null) return null;
  return leerDb().usuarios.find((u) => u.id === id) ?? null;
}

export async function actualizarMiInformacion(datos: {
  nombreCompleto: string;
  fechaNacimiento: FechaISO | '';
  niveles: Nivel[];
  telefono?: string;
}): Promise<void> {
  const id = exigirUsuarioId();
  const nombre = datos.nombreCompleto.trim();
  const errores: Record<string, string> = {};
  if (nombre === '') errores.nombreCompleto = 'Escribe tu nombre completo.';
  if (datos.fechaNacimiento === '') {
    errores.fechaNacimiento = 'Escribe tu fecha de nacimiento.';
  } else if (!esFechaISO(datos.fechaNacimiento)) {
    errores.fechaNacimiento = 'La fecha de nacimiento no es válida.';
  } else if (datos.fechaNacimiento > hoy()) {
    errores.fechaNacimiento = 'La fecha de nacimiento no puede ser futura.';
  }
  const niveles = datos.niveles.filter((n, i, lista) => lista.indexOf(n) === i);
  if (niveles.length === 0) errores.niveles = 'Elige al menos un nivel que dictas.';
  if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);

  const telefono = datos.telefono?.trim() ?? '';
  escribirDb((db) => {
    const usuario = db.usuarios.find((u) => u.id === id);
    if (!usuario) throw new ErrorNegocio('La cuenta no existe.');
    usuario.nombreCompleto = nombre;
    usuario.fechaNacimiento = datos.fechaNacimiento;
    usuario.niveles = niveles;
    if (telefono === '') delete usuario.telefono;
    else usuario.telefono = telefono;
  });
}

export async function solicitarRecuperacion(correo: string): Promise<void> {
  const clave = normalizarCorreo(correo);
  if (!correoValido(clave)) throw new ErrorValidacion({ correo: 'Escribe un correo válido.' });

  escribirDb((db) => {
    const usuario = db.usuarios.find((u) => u.correo === clave);
    // Correo no registrado: no se genera nada, y la UI muestra el mismo mensaje.
    if (!usuario) return;
    const token = nuevoId();
    db.tokens.push({ token, usuarioId: usuario.id, creadoEn: ahoraISO(), usado: false });
    const origen = typeof location !== 'undefined' ? location.origin : '';
    const correoSimulado: CorreoSimulado = {
      id: nuevoId(),
      para: usuario.correo,
      asunto: 'Restablece tu contraseña',
      cuerpo: `Hola ${usuario.nombreCompleto}. Usa este enlace para crear una nueva contraseña. Vence en 1 hora.`,
      enlace: `${origen}/restablecer?token=${token}`,
      fecha: ahoraISO(),
    };
    db.correos.push(correoSimulado);
  });
}

export async function validarToken(token: string): Promise<boolean> {
  const registro = leerDb().tokens.find((t) => t.token === token);
  return registro !== undefined && vigente(registro);
}

export async function restablecerContrasena(token: string, nueva: string): Promise<void> {
  if (nueva.length < MINIMO_CONTRASENA) {
    throw new ErrorValidacion({ contrasena: `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.` });
  }
  const sal = nuevaSal();
  const hash = await hashContrasena(sal, nueva);
  escribirDb((db) => {
    const registro = db.tokens.find((t) => t.token === token);
    if (!registro || !vigente(registro)) {
      throw new ErrorNegocio('El enlace no es válido o ya venció. Pide uno nuevo.');
    }
    const usuario = db.usuarios.find((u) => u.id === registro.usuarioId);
    if (!usuario) throw new ErrorNegocio('La cuenta no existe.');
    usuario.hashContrasena = hash;
    usuario.sal = sal;
    usuario.intentosFallidos = 0;
    usuario.bloqueado = false;
    registro.usado = true;
  });
}

export async function listarCorreos(): Promise<CorreoSimulado[]> {
  return [...leerDb().correos].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

export async function restablecerDemo(): Promise<void> {
  borrarTodo();
  await cargarDemo();
}

