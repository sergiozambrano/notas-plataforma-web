export type Nivel = 'primaria' | 'secundaria';
export type Grupo = 'ser' | 'saber' | 'hacer';
export const GRUPOS: Grupo[] = ['ser', 'saber', 'hacer'];
export const NOMBRE_GRUPO: Record<Grupo, string> = { ser: 'Ser', saber: 'Saber', hacer: 'Hacer' };
export type ValorNota = number | string;
export type FechaISO = string; // 'yyyy-MM-dd'

export interface Usuario { id: string; nombreCompleto: string; correo: string; hashContrasena: string; sal: string; fechaNacimiento?: FechaISO; niveles: Nivel[]; telefono?: string; intentosFallidos: number; bloqueado: boolean; }
export interface TokenRecuperacion { token: string; usuarioId: string; creadoEn: string; usado: boolean; }
export interface CorreoSimulado { id: string; para: string; asunto: string; cuerpo: string; enlace: string; fecha: string; }
export interface LetraEscala { letra: string; equivalente: number; }
export type Escala =
  | { tipo: 'numerica'; notaMin: number; notaMax: number; decimales: 1 | 2 }
  | { tipo: 'letras'; letras: LetraEscala[] };
export interface NivelesNacionales { bajo: number; basico: number; alto: number; superior: number; }
export interface Perfil { id: string; usuarioId: string; nombre: string; activo: boolean; escala: Escala; notaAprobar: ValorNota; nivelesNacionales: NivelesNacionales; asistenciaObligatoria: boolean; }
export interface PorcentajesGrupos { ser: number; saber: number; hacer: number; }
export interface AnioLectivo { id: string; perfilId: string; anio: number; modoPesoPeriodos: 'iguales' | 'varian'; modoGrupos: 'iguales' | 'varian'; gruposIguales: PorcentajesGrupos; }
export interface Periodo { id: string; anioLectivoId: string; fechaInicio: FechaISO; fechaFin: FechaISO; peso?: number; grupos?: PorcentajesGrupos; }
export interface EventoCalendario { id: string; anioLectivoId: string; tipo: 'vacaciones' | 'actividad'; nombre: string; fechaInicio: FechaISO; fechaFin: FechaISO; }
export interface Curso { id: string; anioLectivoId: string; grado: string; grupo: string; }
export interface Materia { id: string; anioLectivoId: string; nombre: string; area?: string; }
export interface Asignacion { id: string; cursoId: string; materiaId: string; }
export interface Estudiante { id: string; cursoId: string; nombres: string; apellidos: string; codigo?: string; }
export interface Actividad { id: string; asignacionId: string; periodoId: string; nombre: string; grupo: Grupo; }
export interface Nota { actividadId: string; estudianteId: string; valor: ValorNota; }
export interface CierrePeriodo { asignacionId: string; periodoId: string; fecha: FechaISO; notasCalculadas: Record<string, number>; }

export interface BaseDatos {
  usuarios: Usuario[]; tokens: TokenRecuperacion[]; correos: CorreoSimulado[];
  intentosCorreoDesconocido: Record<string, number>;
  perfiles: Perfil[]; anios: AnioLectivo[]; periodos: Periodo[]; eventos: EventoCalendario[];
  cursos: Curso[]; materias: Materia[]; asignaciones: Asignacion[]; estudiantes: Estudiante[];
  actividades: Actividad[]; notas: Nota[]; cierres: CierrePeriodo[];
}
