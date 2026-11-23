import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { applyDevQuickstart } from './devQuickstart';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

// Phaser text needs the pixel fonts to be ready before the first frame.
applyDevQuickstart();
void Promise.all([document.fonts.load('16px VT323'), document.fonts.load('12px "Press Start 2P"')]).finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
