import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { existeDb } from '@/core/almacen';
import { cargarDemo } from '@/demo/semilla';

async function arrancar(): Promise<void> {
  try {
    if (!existeDb()) await cargarDemo();
  } catch (e) {
    console.error('No se pudieron cargar los datos de demostración', e);
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void arrancar();
