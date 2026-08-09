import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {navigationRef} from './NavigationService';
import type {
  AuthStackParamList,
  MainTabParamList,
  RootStackParamList,
} from './types';
import {useAuthStore} from '../store/authStore';
import {useUnreadStore} from '../store/unreadStore';
import {LoginScreen} from '../screens/LoginScreen';
import {DashboardScreen} from '../screens/DashboardScreen';
import {ChatListScreen} from '../screens/ChatListScreen';
import {ChatRoomScreen} from '../screens/ChatRoomScreen';
import {NewConversationScreen} from '../screens/NewConversationScreen';
import {NotificationScreen} from '../screens/NotificationScreen';
import {colors} from '../theme/colors';

const RootStack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function tabIconForRoute(
  routeName: keyof MainTabParamList,
  focused: boolean,
): string {
  switch (routeName) {
    case 'Chat':
      return focused ? 'chat' : 'chat-outline';
    case 'Profile':
      return focused ? 'account-circle' : 'account-circle-outline';
    case 'Notifications':
      return focused ? 'bell' : 'bell-outline';
    default:
      return 'circle-outline';
  }
}

function MainTabs(): React.JSX.Element {
  const totalChatUnread = useUnreadStore(state => state.totalChatUnread);
  const unreadNotificationCount = useUnreadStore(
    state => state.unreadNotificationCount,
  );

  return (
    <Tab.Navigator
      detachInactiveScreens={false}
      screenOptions={({route}) => ({
        freezeOnBlur: false,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.textPrimary,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: ({color, focused, size}) => (
          <MaterialCommunityIcons
            color={color}
            name={tabIconForRoute(route.name, focused)}
            size={size}
          />
        ),
      })}>
      <Tab.Screen
        component={ChatListScreen}
        name="Chat"
        options={{
          tabBarBadge: totalChatUnread > 0 ? totalChatUnread : undefined,
        }}
      />
      <Tab.Screen component={DashboardScreen} name="Profile" />
      <Tab.Screen
        component={NotificationScreen}
        name="Notifications"
        options={{
          tabBarBadge:
            unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
        }}
      />
    </Tab.Navigator>
  );
}

function AuthNavigator(): React.JSX.Element {
  return (
    <AuthStack.Navigator screenOptions={{headerShown: false}}>
      <AuthStack.Screen component={LoginScreen} name="Login" />
    </AuthStack.Navigator>
  );
}

export function AppNavigator(): React.JSX.Element {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  return (
    <NavigationContainer ref={navigationRef}>
      {isAuthenticated ? (
        <RootStack.Navigator detachInactiveScreens={false}>
          <RootStack.Screen
            component={MainTabs}
            name="MainTabs"
            options={{headerShown: false}}
          />
          <RootStack.Screen
            component={ChatRoomScreen}
            name="ChatRoom"
            options={{title: 'Chat Room'}}
          />
          <RootStack.Screen
            component={NewConversationScreen}
            name="NewConversation"
            options={{title: 'New Chat'}}
          />
        </RootStack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
