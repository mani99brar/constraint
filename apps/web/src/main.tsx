import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { themeStyleSheet } from './theme';
import './styles.css';

// The theme tokens come from `theme.ts`, the one place their contrast is tested.
const theme = document.createElement('style');
theme.dataset.theme = 'tokens';
theme.textContent = themeStyleSheet();
document.head.prepend(theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
