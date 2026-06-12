import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = typeof reason === 'string'
    ? reason
    : reason instanceof Error
      ? reason.message
      : '';

  // Ignore browser-extension channel closures that are external to the app runtime.
  if (message.includes('A listener indicated an asynchronous response by returning true')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
