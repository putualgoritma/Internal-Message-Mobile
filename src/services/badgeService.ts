import {NativeModules} from 'react-native';

const {BadgeModule} = NativeModules;

export function setBadgeCount(count: number): void {
  if (BadgeModule && typeof BadgeModule.setBadgeCount === 'function') {
    BadgeModule.setBadgeCount(Math.max(0, Math.round(count)));
  }
}
