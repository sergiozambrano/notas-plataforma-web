# Gestión de notas

Prototipo web para docentes de primaria y secundaria en Colombia: perfiles de institución, años lectivos, periodos, cursos, materias, estudiantes, actividades y notas, con cálculo de periodo y definitiva según las reglas de cada institución.

Todo se guarda en el navegador (localStorage). No hay backend.

## Requisitos

- Node.js 20 LTS (versión 20.19 o superior; Vite 8 no funciona con versiones anteriores de Node 20).

## Instalación y ejecución

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # typecheck + build de producción en dist/
npm run preview  # sirve el build generado
npm test         # pruebas unitarias (Vitest)
```

Al abrir la aplicación por primera vez se cargan datos de demostración. En la pantalla de inicio de sesión, el botón **Restablecer datos de demostración** borra todo y vuelve a cargarlos.

## Despliegue en Cloudflare Pages

- Comando de build: `npm run build`
- Carpeta de salida: `dist`
- `public/_redirects` contiene `/* /index.html 200` para que las rutas del SPA funcionen al recargar.

## Credenciales de demostración

| Cuenta | Correo | Contraseña | Contenido |
|---|---|---|---|
| 1 | demo@gestionnotas.co | Demo1234 | Perfiles "Colegio San José" (numérico) y "Escuela Rural La Esperanza" (letras) |
| 2 | docente2@gestionnotas.co | Demo1234 | Perfil "Colegio Nuevo Horizonte", para probar el aislamiento (HU-21) |

El año anterior del Perfil A existe solo para verificar HU-09.

Las fechas de la demostración se calculan con el año del equipo. En el Perfil A, los periodos ya terminados están finalizados; el Perfil B no tiene ningún periodo finalizado, para poder editar su configuración.

## Bandeja de correo simulada

No se envía ningún correo real. Al pedir recuperar la contraseña, el correo se guarda en la **Bandeja de correo (simulada)**, a la que se entra desde la pantalla de inicio de sesión (`/bandeja`). Allí aparecen el destinatario, el asunto, la fecha y el enlace de restablecimiento, válido por 1 hora y de un solo uso.

## Advertencia de seguridad

Es un prototipo para una actividad universitaria. La contraseña se guarda como hash SHA-256 con sal (Web Crypto) y la sesión y los datos viven en localStorage. Es una **simulación y no ofrece seguridad real**: cualquiera con acceso al navegador puede leer los datos. No usar con datos reales de estudiantes.

## Historias de usuario implementadas

- HU-01 Registro de docente
- HU-02 Inicio y cierre de sesión (bloqueo al tercer fallo)
- HU-03 Recuperar contraseña
- HU-04 Información previa del docente
- HU-05 Gestionar perfiles de institución
- HU-06 Escala de calificación
- HU-07 Nota para aprobar y equivalencia nacional
- HU-08 Asistencia obligatoria u opcional
- HU-09 Registros por año lectivo
- HU-10 Periodos (fechas)
- HU-11 Peso de los periodos y porcentajes de Ser, Saber y Hacer
- HU-12 Vacaciones y actividades escolares
- HU-13 Crear cursos
- HU-14 Materias y carga académica
- HU-15 Registrar estudiantes uno a uno
- HU-16 Actividades por grupo (Ser, Saber, Hacer)
- HU-17 Registrar notas
- HU-18 Finalizar el periodo
- HU-19 Calcular la nota del periodo
- HU-20 Nota definitiva y aprobación
- HU-21 Acceso solo a mis datos

## Dónde se verifica cada HU

| HU | Pantalla | Ruta |
|---|---|---|
| HU-01 | Registro | `/registro` |
| HU-02 | Iniciar sesión; cerrar sesión desde la barra superior | `/iniciar-sesion` |
| HU-03 | Recuperar contraseña, restablecer y bandeja simulada | `/recuperar`, `/restablecer`, `/bandeja` |
| HU-04 | Mi información | `/mi-informacion` |
| HU-05 | Perfiles (lista y detalle) | `/perfiles`, `/perfiles/:perfilId` |
| HU-06 | Detalle de perfil, pestaña Escala | `/perfiles/:perfilId` |
| HU-07 | Detalle de perfil, pestaña Aprobación y niveles | `/perfiles/:perfilId` |
| HU-08 | Detalle de perfil, pestaña Asistencia | `/perfiles/:perfilId` |
| HU-09 | Selector de año lectivo (barra superior) | Cualquier pantalla interna |
| HU-10 | Periodos (fechas) y panel del periodo en curso | `/periodos`, `/panel` |
| HU-11 | Periodos (pesos y porcentajes de Ser, Saber y Hacer) | `/periodos` |
| HU-12 | Calendario | `/calendario` |
| HU-13 | Cursos | `/cursos` |
| HU-14 | Materias y carga académica | `/materias` |
| HU-15 | Estudiantes por curso | `/estudiantes`, `/estudiantes/:cursoId` |
| HU-16 | Planilla: actividades por grupo | `/planilla/:asignacionId/:periodoId` |
| HU-17 | Planilla: registro de notas | `/planilla/:asignacionId/:periodoId` |
| HU-18 | Planilla: botón Finalizar periodo | `/planilla/:asignacionId/:periodoId` |
| HU-19 | Planilla (nota del periodo) y Definitivas | `/planilla/:asignacionId/:periodoId`, `/definitivas/:asignacionId` |
| HU-20 | Definitivas: nivel, Aprueba / No aprueba | `/definitivas`, `/definitivas/:asignacionId` |
| HU-21 | Cualquier recurso ajeno abierto por URL | Pantalla "No tienes permiso" en cualquier ruta interna |

Notas sobre la fecha del equipo (HU-18.2):

- "Listo para finalizar" y los cierres manuales dependen de la fecha del equipo. Un periodo solo se finaliza cuando hoy es igual o posterior a su fecha de fin.
- Los datos de demostración usan el año actual del equipo; si cambia el año, la demo se ajusta al cargarla de nuevo.
