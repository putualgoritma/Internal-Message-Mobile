import {
  LogLevel,
  OneSignal,
  type NotificationClickEvent,
} from 'react-native-onesignal';

import {APP_CONFIG} from '../config/appConfig';

type PushTapCallback = (payload: Record<string, unknown>) => void;

let initialized = false;
let registeredTapListener: ((event: NotificationClickEvent) => void) | null = null;

export function initializePush(onTap: PushTapCallback): void {
  if (initialized || !APP_CONFIG.oneSignalAppId) {
    return;
  }

  OneSignal.Debug.setLogLevel(__DEV__ ? LogLevel.Debug : LogLevel.Warn);
  OneSignal.initialize(APP_CONFIG.oneSignalAppId);
  OneSignal.Notifications.requestPermission(true).catch(() => {
    // Permission request errors are non-fatal.
  });

  registeredTapListener = event => {
    const payload =
      (event.notification.additionalData as Record<string, unknown>) ?? {};
    onTap(payload);
  };

  OneSignal.Notifications.addEventListener('click', registeredTapListener);
  initialized = true;
}

export function setPushIdentity(userId: string | null): void {
  if (!initialized) {
    return;
  }

  if (!userId) {
    OneSignal.logout();
    return;
  }

  OneSignal.login(userId);
}

export function teardownPush(): void {
  if (!initialized || !registeredTapListener) {
    return;
  }

  OneSignal.Notifications.removeEventListener('click', registeredTapListener);
  registeredTapListener = null;
  initialized = false;
}

export async function getPushSubscriptionId(): Promise<string | null> {
  if (!initialized) {
    return null;
  }

  try {
    const pushId = await OneSignal.User.pushSubscription.getPushSubscriptionId();
    return pushId || null;
  } catch {
    return null;
  }
}
