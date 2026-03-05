import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.ca12acbb7d5746d89d77109ee6b9dc68',
  appName: 'SeaLogg',
  webDir: 'dist',
  // Use bundled web assets from dist in native app.
  // (Temporarily disable remote server URL to avoid stale remote content.)
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false, // we hide manually after init
      backgroundColor: '#0A1628',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
