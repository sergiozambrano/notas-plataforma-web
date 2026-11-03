import type { Grupo } from './tipos';

export class ErrorValidacion extends Error {
  constructor(public campos: Record<string, string>, mensaje?: string) {
    super(mensaje ?? Object.values(campos)[0] ?? 'Revisa los datos marcados.');
    this.name = 'ErrorValidacion';
  }
}

export class ErrorNegocio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorNegocio';
  }
}

export class ErrorAcceso extends Error {
  constructor(mensaje = 'No tienes permiso para ver este recurso.') {
    super(mensaje);
    this.name = 'ErrorAcceso';
  }
}

export class ErrorSesion extends Error {
  constructor(mensaje = 'Debes iniciar sesión para continuar.') {
    super(mensaje);
    this.name = 'ErrorSesion';
  }
}

export class ErrorAdvertencia extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorAdvertencia';
  }
}

export interface DetalleFinalizar {
  antesDeFecha?: string; /* fechaFin */
  gruposSinActividades: Grupo[];
  pendientes: { estudiante: string; actividad: string }[];
  sinEstudiantes?: boolean;
  configuracion: string[];
}

export class ErrorFinalizar extends Error {
  constructor(public detalle: DetalleFinalizar) {
    super('No se puede finalizar el periodo todavía.');
    this.name = 'ErrorFinalizar';
  }
}
