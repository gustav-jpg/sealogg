import { isNativePlatform } from '@/lib/capacitor';

/**
 * Initialize native Capacitor plugins on app startup.
 * Call this once in App.tsx or main.tsx.
 */
export async function initNativePlugins() {
  if (!isNativePlatform()) return;

  try {
    // Configure status bar
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0A1628' }); // matches app dark bg
  } catch (e) {
    console.warn('[Native] StatusBar not available:', e);
  }

  try {
    // Hide splash screen after app is ready
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (e) {
    console.warn('[Native] SplashScreen not available:', e);
  }

  try {
    // Set up deep linking
    const { App } = await import('@capacitor/app');
    App.addListener('appUrlOpen', (event) => {
      console.log('[Native] Deep link:', event.url);
      const url = new URL(event.url);
      const path = url.pathname;
      if (path) {
        window.location.href = path;
      }
    });

    // Handle back button on Android
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch (e) {
    console.warn('[Native] App plugin not available:', e);
  }
}
