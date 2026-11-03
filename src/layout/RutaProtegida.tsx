import { Navigate, Outlet } from 'react-router-dom';
import { usuarioIdSesion } from '@/core/sesion';

/** Rutas internas: sin sesión redirige a /iniciar-sesion (HU-21.3). */
export function RutaProtegida() {
  if (usuarioIdSesion() === null) {
    return <Navigate to="/iniciar-sesion" replace />;
  }
  return <Outlet />;
}
