import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';

// NOTE: HelmetProvider temporarily disabled to fix DOM manipulation errors in dev
// import { HelmetProvider } from 'react-helmet-async';

console.log('[App] Initializing Chowkar application...');
console.log('[App] Environment check:', {
  hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
  hasSupabaseKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
  hasGeminiKey: !!import.meta.env.VITE_GEMINI_API_KEY
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // NOTE: StrictMode and HelmetProvider disabled to avoid 'removeChild' errors
  <ErrorBoundary>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </ErrorBoundary>
);