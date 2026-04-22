import React, {useEffect} from 'react';
import {ActivityIndicator, LogBox, StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {APP_CONFIG} from './src/config/appConfig';
import {AppNavigator} from './src/navigation/AppNavigator';
import {navigate} from './src/navigation/NavigationService';
import {initializePush, setPushIdentity} from './src/services/pushService';
import {setBadgeCount} from './src/services/badgeService';
import {useRealtime} from './src/hooks/useRealtime';
import {useAuthStore} from './src/store/authStore';
import {useUnreadStore} from './src/store/unreadStore';
import {colors} from './src/theme/colors';

function AppBootstrap(): React.JSX.Element {
  const isBootstrapping = useAuthStore(state => state.isBootstrapping);
  const bootstrapSession = useAuthStore(state => state.bootstrapSession);
  const userId = useAuthStore(state => state.user?.id);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const totalChatUnread = useUnreadStore(state => state.totalChatUnread);

  useRealtime();

  useEffect(() => {
    setBadgeCount(totalChatUnread);
  }, [totalChatUnread]);

  useEffect(() => {
    LogBox.ignoreLogs([
      'The result of getSnapshot should be cached to avoid an infinite loop',
      'Maximum update depth exceeded',
    ]);
  }, []);

  useEffect(() => {
    bootstrapSession().catch(() => {
      // bootstrap errors are handled in auth store.
    });
  }, [bootstrapSession]);

  useEffect(() => {
    initializePush(payload => {
      const conversationId = Number(
        payload?.conversation_id ?? payload?.conversationId ?? 0,
      );

      if (conversationId > 0) {
        navigate('ChatRoom', {conversationId});
        return;
      }

      navigate('MainTabs');
    });
  }, []);

  useEffect(() => {
    if (!APP_CONFIG.oneSignalAppId) {
      return;
    }

    if (isAuthenticated && userId) {
      setPushIdentity(String(userId));
      return;
    }

    setPushIdentity(null);
  }, [isAuthenticated, userId]);

  if (isBootstrapping) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return <AppNavigator />;
}

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <AppBootstrap />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});

export default App;
