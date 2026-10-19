import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.runhigh',
  appName: '런하이',
  webDir: 'dist',
  android: {
    // 서버 모드에서 http(개발용) API를 쓸 때만 필요하면 true로 바꾸세요
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#6D57FC',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_runhigh',
      iconColor: '#6D57FC',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#F7F6FD',
      overlaysWebView: false,
    },
  },
};

export default config;
