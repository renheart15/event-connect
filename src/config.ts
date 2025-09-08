// API Configuration for different environments
export const API_CONFIG = {
  get BASE_URL() {
    // Force localhost in development
    if (import.meta.env.DEV) {
      return 'http://localhost:5000';
    }
    
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
console.log('API Config:', {
  baseUrl: API_CONFIG.BASE_URL,
  apiBase: API_CONFIG.API_BASE,
  protocol: window?.location?.protocol || 'unknown',
  hostname: window?.location?.hostname || 'unknown'
});