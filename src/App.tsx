import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { ContextoApp } from './layout/ContextoApp';
import { LayoutInterno } from './layout/LayoutInterno';
import { RutaProtegida } from './layout/RutaProtegida';
import { Encabezado } from '@/ui';
import { IniciarSesionPagina } from '@/modules/auth/paginas/IniciarSesionPagina';
import { RegistroPagina } from '@/modules/auth/paginas/RegistroPagina';
import { RecuperarPagina } from '@/modules/auth/paginas/RecuperarPagina';
import { RestablecerPagina } from '@/modules/auth/paginas/RestablecerPagina';
import { BandejaPagina } from '@/modules/auth/paginas/BandejaPagina';
import { MiInformacionPagina } from '@/modules/auth/paginas/MiInformacionPagina';
import { PanelPagina } from '@/modules/panel/paginas/PanelPagina';
import { PerfilesPagina } from '@/modules/perfiles/paginas/PerfilesPagina';
import { PerfilDetallePagina } from '@/modules/perfiles/paginas/PerfilDetallePagina';
import { PeriodosPagina } from '@/modules/periodos/paginas/PeriodosPagina';
import { CalendarioPagina } from '@/modules/calendario/paginas/CalendarioPagina';
import { CursosPagina } from '@/modules/cursos/paginas/CursosPagina';
import { MateriasPagina } from '@/modules/materias/paginas/MateriasPagina';
import { EstudiantesPagina } from '@/modules/estudiantes/paginas/EstudiantesPagina';
import { EstudiantesCursoPagina } from '@/modules/estudiantes/paginas/EstudiantesCursoPagina';
import { PlanillaPagina } from '@/modules/evaluacion/paginas/PlanillaPagina';
import { PlanillaDetallePagina } from '@/modules/evaluacion/paginas/PlanillaDetallePagina';
import { DefinitivasPagina } from '@/modules/evaluacion/paginas/DefinitivasPagina';
import { DefinitivasDetallePagina } from '@/modules/evaluacion/paginas/DefinitivasDetallePagina';

function NoEncontrado() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <Encabezado titulo="No encontrado" descripcion="La página que buscas no existe." />
      <Link
        to="/panel"
        className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
      >
        Ir al panel
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/panel" replace />} />
        <Route path="/iniciar-sesion" element={<IniciarSesionPagina />} />
        <Route path="/registro" element={<RegistroPagina />} />
        <Route path="/recuperar" element={<RecuperarPagina />} />
        <Route path="/restablecer" element={<RestablecerPagina />} />
        <Route path="/bandeja" element={<BandejaPagina />} />

        <Route element={<RutaProtegida />}>
          <Route
            element={
              <ContextoApp>
                <LayoutInterno />
              </ContextoApp>
            }
          >
            <Route path="/panel" element={<PanelPagina />} />
            <Route path="/mi-informacion" element={<MiInformacionPagina />} />
            <Route path="/perfiles" element={<PerfilesPagina />} />
            <Route path="/perfiles/:perfilId" element={<PerfilDetallePagina />} />
            <Route path="/periodos" element={<PeriodosPagina />} />
            <Route path="/calendario" element={<CalendarioPagina />} />
            <Route path="/cursos" element={<CursosPagina />} />
            <Route path="/materias" element={<MateriasPagina />} />
            <Route path="/estudiantes" element={<EstudiantesPagina />} />
            <Route path="/estudiantes/:cursoId" element={<EstudiantesCursoPagina />} />
            <Route path="/planilla" element={<PlanillaPagina />} />
            <Route path="/planilla/:asignacionId/:periodoId" element={<PlanillaDetallePagina />} />
            <Route path="/definitivas" element={<DefinitivasPagina />} />
            <Route path="/definitivas/:asignacionId" element={<DefinitivasDetallePagina />} />
          </Route>
        </Route>

        <Route path="*" element={<NoEncontrado />} />
      </Routes>
    </BrowserRouter>
  );
}
