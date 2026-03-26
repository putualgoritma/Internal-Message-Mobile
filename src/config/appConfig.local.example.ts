import type {AppConfig} from './appConfig';

export const APP_CONFIG_LOCAL: Partial<AppConfig> = {
  apiBaseUrl: 'https://YOUR_API_HOST/api/v1',
  broadcastAuthUrl: 'https://YOUR_API_HOST/broadcasting/auth',
  wsHost: 'YOUR_WS_HOST',
  wsPort: 443,
  wsScheme: 'https',
  wsPath: '/app',
  wsAppKey: 'YOUR_PUSHER_APP_KEY',
  wsCluster: 'mt1',
  oneSignalAppId: 'YOUR_ONESIGNAL_APP_ID',
};
