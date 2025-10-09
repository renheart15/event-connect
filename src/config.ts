// API Configuration for different environments
const _baseUrl = import.meta.env.DEV
  ? 'http://localhost:5000' // Local development
  : 'https://event-connect-backend.onrender.com'; // Render backend deployment

export const API_CONFIG = {
  get BASE_URL() {
    return _baseUrl;
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