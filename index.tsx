import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { initSupabase } from './lib/supabase';

// NOTE: HelmetProvider enabled for production
import { HelmetProvider } from 'react-helmet-async';

console.log('[App] Initializing Chowkar application...');
console.log('[App] Environment check:', {
  hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
  hasSupabaseKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
  hasGeminiKey: !!import.meta.env.VITE_GEMINI_API_KEY
});

// Initialize Supabase client early to ensure auth state is resolved before queries
initSupabase();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // NOTE: StrictMode disabled to avoid 'removeChild' errors, but SEO enabled
  <ErrorBoundary>
    <HelmetProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </HelmetProvider>
  </ErrorBoundary>
);