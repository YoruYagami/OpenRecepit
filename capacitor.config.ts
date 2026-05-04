import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.scontrini.trasferta',
  appName: 'Scontrini Trasferta',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    Camera: {
      // permissions auto-handled by plugin
    },
  },
};

export default config;
