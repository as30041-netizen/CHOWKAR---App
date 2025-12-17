import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'in.chowkar.app',
    appName: 'CHOWKAR',
    webDir: 'dist',
    server: {
        androidScheme: 'https',
        cleartext: true
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            backgroundColor: "#10b981",
            showSpinner: true,
            spinnerColor: "#ffffff"
        }
    }
};

export default config;
