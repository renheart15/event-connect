// API Configuration for different environments
export const API_CONFIG = {
  get BASE_URL() {
    // Check if we have a backend URL from environment variables first
    if (import.meta.env.VITE_BACKEND_URL) {
      console.log('Using backend URL from environment:', import.meta.env.VITE_BACKEND_URL);
      return import.meta.env.VITE_BACKEND_URL;
    }

    // In production build, try the production server
    if (import.meta.env.PROD) {
      console.log('Production build, using backend.event-connect.site');
      return 'https://backend.event-connect.site';
    }

    // Development mode - use localhost
    console.log('Development mode, using localhost');
    return 'http://localhost:5000';

    // Use localhost when running locally, cloudflare tunnel when deployed
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:5000';
      }
      // If running on trycloudflare.com domain, use the corresponding backend tunnel
      if (hostname.includes('trycloudflare.com')) {
        return import.meta.env.VITE_BACKEND_URL || 'https://your-backend-tunnel.trycloudflare.com';
      }
    }
    // Default to production backend for external access
    return import.meta.env.VITE_BACKEND_URL || 'https://backend.event-connect.site';
  },
  
  get API_BASE() {
    return `${this.BASE_URL}/api`;
  }
};

// Debug logging
console.log('API Config DEBUG:', {
  baseUrl: API_CONFIG.BASE_URL,
  apiBase: API_CONFIG.API_BASE,
  isProd: import.meta.env.PROD,
  isDev: import.meta.env.DEV,
  mode: import.meta.env.MODE,
  protocol: window?.location?.protocol || 'unknown',
  hostname: window?.location?.hostname || 'unknown',
  userAgent: navigator?.userAgent || 'unknown'
});