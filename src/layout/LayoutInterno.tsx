import { useState } from 'react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Boton, Campo, Cargando, Seleccion } from '@/ui';
import { anioActual } from '@/core/reloj';
import * as auth from '@/modules/auth/auth.servicio';
import { useApp } from './ContextoApp';

const MENU = [
  { ruta: '/panel', etiqueta: 'Panel' },
  { ruta: '/mi-informacion', etiqueta: 'Mi información' },
  { ruta: '/perfiles', etiqueta: 'Perfiles' },
  { ruta: '/periodos', etiqueta: 'Periodos' },
  { ruta: '/calendario', etiqueta: 'Calendario' },
  { ruta: '/cursos', etiqueta: 'Cursos' },
  { ruta: '/materias', etiqueta: 'Materias y carga' },
  { ruta: '/estudiantes', etiqueta: 'Estudiantes' },
  { ruta: '/planilla', etiqueta: 'Planilla' },
  { ruta: '/definitivas', etiqueta: 'Definitivas' },
];

/**
 * Barra superior (perfil, año, usuario, cerrar sesión), menú lateral en
 * escritorio y desplegable en celular, y banda de solo consulta.
 */
export function LayoutInterno() {
  const app = useApp();
  const navegar = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  if (!app.cargando && !app.usuario) {
    return <Navigate to="/iniciar-sesion" replace />;
  }

  async function cerrarSesion() {
    await auth.cerrarSesion();
    navegar('/iniciar-sesion', { replace: true });
  }

  const anioEnCurso = anioActual();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-end">
          <div className="flex items-center justify-between gap-3">
            <span className="text-base font-semibold text-teal-800">Gestión de notas</span>
            <button
              type="button"
              aria-expanded={menuAbierto}
              aria-controls="menu-principal"
              onClick={() => setMenuAbierto((v) => !v)}
              className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 md:hidden"
            >
              {menuAbierto ? 'Cerrar menú' : 'Menú'}
            </button>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:flex-1">
            <Campo label="Perfil" className="min-w-0 md:w-64">
              <Seleccion
                value={app.perfil?.id ?? ''}
                disabled={app.perfiles.length === 0}
                onChange={(e) => void app.seleccionarPerfil(e.target.value)}
              >
                {app.perfiles.length === 0 ? <option value="">Sin perfiles</option> : null}
                {app.perfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.activo ? p.nombre : `${p.nombre} (inactivo)`}
                  </option>
                ))}
              </Seleccion>
            </Campo>
            <Campo label="Año lectivo" className="min-w-0 md:w-44">
              <Seleccion
                value={app.anio?.id ?? ''}
                disabled={app.anios.length === 0}
                onChange={(e) => void app.seleccionarAnio(e.target.value)}
              >
                {app.anios.length === 0 ? <option value="">Sin años</option> : null}
                {app.anios.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.anio < anioEnCurso ? `${a.anio} (anterior)` : String(a.anio)}
                  </option>
                ))}
              </Seleccion>
            </Campo>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-3 md:ml-auto md:flex-none">
            <span className="min-w-0 truncate text-sm text-slate-700" title={app.usuario?.nombreCompleto}>
              {app.usuario?.nombreCompleto ?? ''}
            </span>
            <Boton variant="secundario" onClick={() => void cerrarSesion()} className="shrink-0">
              Cerrar sesión
            </Boton>
          </div>
        </div>
      </header>

      {app.motivoSoloLectura ? (
        <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <div className="mx-auto max-w-6xl">{app.motivoSoloLectura}</div>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-6xl flex-col md:flex-row">
        <nav
          id="menu-principal"
          aria-label="Principal"
          className={`${menuAbierto ? 'block' : 'hidden'} border-b border-slate-200 bg-white md:block md:w-52 md:shrink-0 md:border-b-0 md:border-r`}
        >
          <ul className="flex flex-col p-2">
            {MENU.map((item) => (
              <li key={item.ruta}>
                <NavLink
                  to={item.ruta}
                  onClick={() => setMenuAbierto(false)}
                  className={({ isActive }) =>
                    `block min-h-10 rounded-md px-3 py-2 text-sm ${
                      isActive ? 'bg-teal-50 font-semibold text-teal-900' : 'text-slate-700 hover:bg-slate-100'
                    }`
                  }
                >
                  {item.etiqueta}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          {app.cargando ? <Cargando /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
