import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.elghazzali.shelflife',
  appName: 'Shelf Life',
  webDir: 'dist',
  server: {
    iosScheme: 'shelflife',
  },
  plugins: {
    Keyboard: {
      resize: 'none',
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      iosClientId: '85349367000-f4kbrcjau1m91p6m2guukhpn4s1u6uh4.apps.googleusercontent.com',
      serverClientId: '85349367000-ivi9t52af55dom7fp1nslcq7j1i76v7d.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
