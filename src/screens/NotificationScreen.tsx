import React, {useCallback} from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';

import {EmptyState} from '../components/EmptyState';
import {ErrorBanner} from '../components/ErrorBanner';
import {colors} from '../theme/colors';
import {useNotificationStore} from '../store/notificationStore';
import type {NotificationItem} from '../types/models';
import type {RootStackParamList} from '../navigation/types';

type Navigation = StackNavigationProp<RootStackParamList>;

function toConversationId(notification: NotificationItem): number {
  const value =
    notification.data?.conversation_id ?? notification.data?.conversationId ?? 0;
  return Number(value ?? 0);
}

function NotificationItemRow({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, !item.is_read ? styles.rowUnread : null]}>
      <Text numberOfLines={1} style={styles.rowTitle}>
        {item.title}
      </Text>
      <Text numberOfLines={2} style={styles.rowBody}>
        {item.body}
      </Text>
      <Text style={styles.rowMeta}>{new Date(item.created_at).toLocaleString()}</Text>
    </Pressable>
  );
}

export function NotificationScreen(): React.JSX.Element {
  const navigation = useNavigation<Navigation>();
  const notifications = useNotificationStore(state => state.notifications);
  const loading = useNotificationStore(state => state.loading);
  const error = useNotificationStore(state => state.error);
  const fetchNotifications = useNotificationStore(state => state.fetchNotifications);
  const markRead = useNotificationStore(state => state.markRead);
  const markAllRead = useNotificationStore(state => state.markAllRead);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      fetchNotifications()
        .then(async () => {
          if (!active) {
            return;
          }

          const hasUnread = useNotificationStore
            .getState()
            .notifications.some(item => !item.is_read);

          if (hasUnread) {
            await markAllRead();
          }
        })
        .catch(() => {
          // Store already captures error state.
        });

      return () => {
        active = false;
      };
    }, [fetchNotifications, markAllRead]),
  );

  const onOpenNotification = async (item: NotificationItem): Promise<void> => {
    if (!item.is_read) {
      await markRead(item.id);
    }

    const conversationId = toConversationId(item);
    if (conversationId > 0) {
      navigation.navigate('ChatRoom', {conversationId});
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Notifications</Text>
        <Pressable
          onPress={() => {
            markAllRead().catch(() => {
              // Store already captures error state.
            });
          }}
          style={styles.markAllButton}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </Pressable>
      </View>
      {error ? <ErrorBanner message={error} /> : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={notifications}
        keyExtractor={item => String(item.id)}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              fetchNotifications().catch(() => {
                // Store already captures error state.
              });
            }}
            refreshing={loading}
          />
        }
        renderItem={({item}) => (
          <NotificationItemRow
            item={item}
            onPress={() => {
              onOpenNotification(item).catch(() => {
                // Store already captures error state.
              });
            }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            subtitle="Push and in-app events will appear here."
            title="No notifications"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    padding: 16,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heading: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  markAllButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  markAllText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 24,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 10,
    padding: 12,
  },
  rowUnread: {
    borderColor: '#9BC9FF',
    borderWidth: 1,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  rowBody: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  rowMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 8,
  },
});
