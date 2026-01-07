import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Suppress harmless browser extension errors
// These errors occur when browser extensions try to communicate with content scripts
// that don't exist, and they don't affect the app's functionality
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const errorMessage = args.join(' ');
    // Filter out common browser extension errors
    if (
      errorMessage.includes('runtime.lastError') ||
      errorMessage.includes('Could not establish connection') ||
      errorMessage.includes('Receiving end does not exist') ||
      errorMessage.includes('Extension context invalidated')
    ) {
      // Silently ignore these harmless extension errors
      return;
    }
    // Log all other errors normally
    originalError.apply(console, args);
  };

  // Also handle unhandled promise rejections from extensions
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason || '');
    if (
      reason.includes('runtime.lastError') ||
      reason.includes('Could not establish connection') ||
      reason.includes('Receiving end does not exist') ||
      reason.includes('Extension context invalidated')
    ) {
      event.preventDefault(); // Prevent the error from being logged
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
