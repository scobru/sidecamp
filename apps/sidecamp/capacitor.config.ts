import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sidecamp.app',
  appName: 'Sidecamp',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Filesystem: {
      persist: true
    },
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
