import {createNavigationContainerRef} from '@react-navigation/native';

import type {RootStackParamList} from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate(
  routeName: keyof RootStackParamList,
  params?: RootStackParamList[keyof RootStackParamList],
): void {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.navigate(routeName as never, params as never);
}
