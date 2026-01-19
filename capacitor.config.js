import { CapacitorConfig } from '@capacitor/cli';

const config = {
  appId: 'com.estherjoseph.citysnowglobe',
  appName: 'City In A Snowglobe',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Uncomment for local development:
    // url: 'http://localhost:5173',
    // cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false, // Set to true for debugging
  },
  ios: {
    scheme: 'https',
    contentInset: 'always',
    // ARKit requires camera permission
    permissions: {
      camera: 'AR mode requires access to the camera to display and track the snow globe in your space.'
    }
  },
};

export default config;

