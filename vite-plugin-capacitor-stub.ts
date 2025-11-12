import { Plugin } from 'vite';

/**
 * Vite plugin to stub Capacitor plugins that don't have web implementations
 * This allows the build to succeed while dynamic imports with try-catch handle runtime
 */
export function capacitorStubPlugin(): Plugin {
  const stubModules = [
    '@capacitor/app',
    '@capacitor/camera',
    '@capacitor/haptics',
    '@capacitor/local-notifications',
    '@capacitor/splash-screen',
    '@capacitor/status-bar',
    '@capacitor-mlkit/barcode-scanning',
  ];

  return {
    name: 'capacitor-stub',
    resolveId(id) {
      if (stubModules.includes(id)) {
        return '\0' + id; // Virtual module prefix
      }
    },
    load(id) {
      const stubModule = stubModules.find(m => id === '\0' + m);
      if (stubModule) {
        // Return a stub module that exports empty objects
        return `export default {};`;
      }
    },
  };
}
