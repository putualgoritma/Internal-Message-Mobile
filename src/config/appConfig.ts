import {Platform} from 'react-native';

export type RuntimeEnvironment = 'development' | 'staging' | 'production';

export interface AppConfig {
  apiBaseUrl: string;
  broadcastAuthUrl: string;
  wsHost: string;
  wsPort: number;
  wsScheme: 'http' | 'https';
  wsPath: string;
  wsAppKey: string;
  wsCluster: string;
  oneSignalAppId: string;
}

const LOCAL_DEV_HOST = Platform.select({
  android: '10.0.2.2',
  ios: '127.0.0.1',
  default: '127.0.0.1',
});

const DEFAULT_CONFIG: AppConfig = {
  apiBaseUrl: `http://${LOCAL_DEV_HOST}:8000/api/v1`,
  broadcastAuthUrl: `http://${LOCAL_DEV_HOST}:8000/broadcasting/auth`,
  wsHost: LOCAL_DEV_HOST,
  wsPort: 6001,
  wsScheme: 'http',
  wsPath: '',     // pusher-js appends /app/{key} automatically; do NOT put '/app' here
  wsAppKey: 'local',
  wsCluster: 'mt1',
  oneSignalAppId: '',
};

const ENV_CONFIG: Record<RuntimeEnvironment, Partial<AppConfig>> = {
  development: {},
  staging: {},
  production: {},
};

function getRuntimeEnvironment(): RuntimeEnvironment {
  return __DEV__ ? 'development' : 'production';
}

function getLocalOverride(): Partial<AppConfig> {
  try {
    const localModule = require('./appConfig.local') as {
      APP_CONFIG_LOCAL?: Partial<AppConfig>;
    };
    return localModule.APP_CONFIG_LOCAL ?? {};
  } catch {
    return {};
  }
}

const runtimeEnvironment = getRuntimeEnvironment();
const localOverride = getLocalOverride();

export const APP_CONFIG: AppConfig = {
  ...DEFAULT_CONFIG,
  ...ENV_CONFIG[runtimeEnvironment],
  ...localOverride,
};

export const APP_TIMEOUT_MS = 15000;
