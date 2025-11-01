import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import reportWebVitals from './reportWebVitals';

// Load config immediately before importing App which uses Supabase
async function initializeApp() {
  const { loadConfig } = await import('./lib/supabase');

  try {
    await loadConfig();
    console.log('Config loaded successfully');
  } catch (error) {
    console.warn('Config load error, will use environment variables:', error);
  }

  // Now import and render the app
  const App = (await import('./App')).default;
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  reportWebVitals();
}

initializeApp().catch((error) => {
  console.error('Failed to initialize app:', error);
});
