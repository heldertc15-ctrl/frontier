import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';
import './shell-refinement.css';
import './world-refinement.css';
import './fishing-refinement.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Frontier could not find its application root.');
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
