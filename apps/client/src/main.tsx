import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { applyDevQuickstart } from './devQuickstart';
import { applyDocumentSettings } from './settings';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

// Phaser text needs the pixel fonts to be ready before the first frame.
applyDevQuickstart();
applyDocumentSettings();

// Offline play: the service worker caches the game after the first visit (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?build=${__BUILD_ID__}`, { scope: import.meta.env.BASE_URL }).catch(() => undefined);
  });
}
void Promise.all([document.fonts.load('16px VT323'), document.fonts.load('12px "Press Start 2P"')]).finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
