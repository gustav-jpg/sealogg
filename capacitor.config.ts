import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.ca12acbb7d5746d89d77109ee6b9dc68',
  appName: 'sealogg',
  webDir: 'dist',
  server: {
    url: 'https://ca12acbb-7d57-46d8-9d77-109ee6b9dc68.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
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
