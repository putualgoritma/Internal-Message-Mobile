import React, {useCallback} from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {colors} from '../theme/colors';
import {ErrorBanner} from '../components/ErrorBanner';
import {useAuthStore} from '../store/authStore';
import {useChatStore} from '../store/chatStore';
import {useNotificationStore} from '../store/notificationStore';
import {useUnreadStore} from '../store/unreadStore';
import {useRealtimeStore} from '../store/realtimeStore';
import type {MainTabParamList} from '../navigation/types';

type DashboardNav = BottomTabNavigationProp<MainTabParamList, 'Dashboard'>;

function StatCard({
  title,
  value,
  caption,
  icon,
  iconColor,
}: {
  title: string;
  value: string;
  caption: string;
  icon: string;
  iconColor: string;
}): React.JSX.Element {
  return (
    <View style={styles.statCard}>
      <View style={[styles.iconCircle, {backgroundColor: iconColor + '15'}]}>
        <MaterialCommunityIcons name={icon} size={28} color={iconColor} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardValue}>{value}</Text>
        <Text style={styles.cardCaption}>{caption}</Text>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    padding: 16,
  },

  /* Header Section */
  headerSection: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  userName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 2,
  },
  userRole: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  headerIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Section Title */
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },

  /* Stat Card */
  statCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 40,
    height: 56,
    justifyContent: 'center',
    marginRight: 14,
    width: 56,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 2,
  },
  cardCaption: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '400',
  },

  /* Realtime Card */
  realtimeCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  realtimeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusIndicatorContainer: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  statusIndicator: {
    borderRadius: 6,
    height: 12,
    marginRight: 8,
    width: 12,
  },
  realtimeTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  realtimeStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
  realtimeDetails: {
    backgroundColor: colors.muted,
    borderRadius: 10,
    gap: 8,
    padding: 10,
  },
  realtimeMeta: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  realtimeMetaText: {
    color: colors.textSecondary,
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },

  /* Notice Section */
  notice: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF8EC',
    borderColor: '#F3D8A5',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 20,
    padding: 12,
  },
  noticeTitle: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  noticeBody: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '500',
  },

  /* Actions */
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'column',
    gap: 8,
    justifyContent: 'center',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  chatButton: {
    backgroundColor: colors.brand,
  },
  notificationButton: {
    backgroundColor: colors.success,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Logout Button */
  logoutButton: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  logoutButtonPressed: {
    opacity: 0.85,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export function DashboardScreen(): React.JSX.Element {
  const navigation = useNavigation<DashboardNav>();
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const fetchConversations = useChatStore(state => state.fetchConversations);
  const fetchNotifications = useNotificationStore(
    state => state.fetchNotifications,
  );
  const loadingConversations = useChatStore(state => state.loadingConversations);
  const loadingNotifications = useNotificationStore(state => state.loading);
  const chatError = useChatStore(state => state.error);
  const notificationError = useNotificationStore(state => state.error);
  const conversationCount = useChatStore(state => state.conversations.length);
  const unreadChatTotal = useUnreadStore(state => state.totalChatUnread);
  const unreadNotificationCount = useUnreadStore(
    state => state.unreadNotificationCount,
  );
  const realtimeStatus = useRealtimeStore(state => state.status);
  const lastRealtimeEvent = useRealtimeStore(state => state.lastEvent);
  const lastRealtimeEventAt = useRealtimeStore(state => state.lastEventAt);

  const refreshing = loadingConversations || loadingNotifications;

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchConversations(), fetchNotifications()]);
  }, [fetchConversations, fetchNotifications]);

  useFocusEffect(
    useCallback(() => {
      refreshAll().catch(() => {
        // Store already captures error state.
      });
    }, [refreshAll]),
  );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            refreshAll().catch(() => {
              // Store already captures error state.
            });
          }}
        />
      }>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View>
          <Text style={styles.greeting}>Welcome back! 👋</Text>
          <Text style={styles.userName}>{user?.name ?? 'User'}</Text>
          <Text style={styles.userRole}>{user?.role ?? 'staff'}</Text>
        </View>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons
            name="account-circle"
            size={48}
            color={colors.brand}
          />
        </View>
      </View>

      {chatError ? <ErrorBanner message={`Chat: ${chatError}`} /> : null}
      {notificationError ? (
        <ErrorBanner message={`Notification: ${notificationError}`} />
      ) : null}

      {/* Stats Grid */}
      <Text style={styles.sectionTitle}>Quick Stats</Text>
      <StatCard
        caption="Messages waiting for you"
        icon="chat-outline"
        iconColor={colors.brand}
        title="Unread Chat"
        value={String(unreadChatTotal)}
      />
      <StatCard
        caption="In-app notifications"
        icon="bell-outline"
        iconColor={colors.success}
        title="Notifications"
        value={String(unreadNotificationCount)}
      />
      <StatCard
        caption="Active conversation threads"
        icon="forum-outline"
        iconColor={colors.warning}
        title="Conversations"
        value={String(conversationCount)}
      />

      {/* Realtime Connection Status */}
      <Text style={styles.sectionTitle}>System Status</Text>
      <View style={styles.realtimeCard}>
        <View style={styles.realtimeHeader}>
          <View style={styles.statusIndicatorContainer}>
            <View
              style={[
                styles.statusIndicator,
                {
                  backgroundColor:
                    realtimeStatus === 'connected'
                      ? colors.success
                      : realtimeStatus === 'connecting'
                        ? colors.warning
                        : colors.danger,
                },
              ]}
            />
            <Text style={styles.realtimeTitle}>Realtime Connection</Text>
          </View>
          <Text
            style={[
              styles.realtimeStatus,
              {
                color:
                  realtimeStatus === 'connected'
                    ? colors.success
                    : realtimeStatus === 'connecting'
                      ? colors.warning
                      : colors.danger,
              },
            ]}>
            {realtimeStatus.toUpperCase()}
          </Text>
        </View>
        <View style={styles.realtimeDetails}>
          <View style={styles.realtimeMeta}>
            <MaterialCommunityIcons
              name="lightning-bolt"
              size={16}
              color={colors.textSecondary}
              style={{marginRight: 8}}
            />
            <Text style={styles.realtimeMetaText}>
              {lastRealtimeEvent ?? 'No events'}
            </Text>
          </View>
          <View style={styles.realtimeMeta}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={16}
              color={colors.textSecondary}
              style={{marginRight: 8}}
            />
            <Text style={styles.realtimeMetaText}>
              {lastRealtimeEventAt
                ? new Date(lastRealtimeEventAt).toLocaleString()
                : 'Never'}
            </Text>
          </View>
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.notice}>
        <MaterialCommunityIcons
          name="information-outline"
          size={20}
          color={colors.warning}
          style={{marginRight: 8}}
        />
        <View style={{flex: 1}}>
          <Text style={styles.noticeTitle}>Requests Module</Text>
          <Text style={styles.noticeBody}>
            Attendance Requests UI is intentionally out of scope in this build.
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <Pressable
          onPress={() => navigation.navigate('Chat')}
          style={({pressed}) => [
            styles.actionButton,
            styles.chatButton,
            pressed && styles.buttonPressed,
          ]}>
          <MaterialCommunityIcons
            name="forum-outline"
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.actionText}>Messages</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Notifications')}
          style={({pressed}) => [
            styles.actionButton,
            styles.notificationButton,
            pressed && styles.buttonPressed,
          ]}>
          <MaterialCommunityIcons name="bell-outline" size={24} color="#FFFFFF" />
          <Text style={styles.actionText}>Alerts</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => {
          logout().catch(() => {
            // Auth store already captures error state.
          });
        }}
        style={({pressed}) => [
          styles.logoutButton,
          pressed && styles.logoutButtonPressed,
        ]}>
        <MaterialCommunityIcons
          name="logout-variant"
          size={18}
          color="#FFFFFF"
          style={{marginRight: 8}}
        />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}
