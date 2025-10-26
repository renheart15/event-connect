import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { Capacitor } from '@capacitor/core'

// Register service worker with update prompt - ONLY for web, not mobile
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  console.log('Registering service worker for web browser...');
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('New content available, prompting user to refresh');
    },
    onOfflineReady() {
      console.log('App is ready to work offline');
    },
    onRegistered(registration) {
      console.log('Service Worker registered:', registration);
      // Check for updates every 60 seconds
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60000);
      }
    },
    onRegisterError(error) {
      console.error('Service Worker registration error:', error);
    }
  });
} else if (Capacitor.isNativePlatform()) {
  console.log('Running in native mobile app - skipping service worker registration');
}

// Deployment debug info
const deploymentTimestamp = new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
const buildVersion = `Build-${Date.now()}`;
console.log(`🚀 Event Connect Deployment Debug:`, {
  timestamp: deploymentTimestamp,
  version: buildVersion,
  date: new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }),
  userAgent: navigator.userAgent
});
console.log('🔍 If you see this log, the latest deployment is loaded!');

// Add error logging for white screen debugging
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  createRoot(rootElement).render(<App />);
  console.log('App rendered successfully');
} catch (error) {
  console.error('Failed to render app:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center; font-family: Arial, sans-serif;">
      <h1 style="color: red;">Application Error</h1>
      <p>Failed to start the application. Please check the console for details.</p>
      <p>Error: ${error?.message || 'Unknown error'}</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; margin-top: 10px;">Reload Page</button>
    </div>
  `;
}
