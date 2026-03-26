import {useEffect, useMemo} from 'react';

import {useAuthStore} from '../store/authStore';
import {useChatStore} from '../store/chatStore';
import {useNotificationStore} from '../store/notificationStore';
import {useUnreadStore} from '../store/unreadStore';
import {websocketService} from '../services/websocketService';
import type {ChatMessage, NotificationItem} from '../types/models';

export function useRealtime(): void {
  const token = useAuthStore(state => state.token);
  const userId = useAuthStore(state => state.user?.id);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const conversations = useChatStore(state => state.conversations);
  const conversationIds = useMemo(
    () => conversations.map(item => item.id),
    [conversations],
  );

  const stableConversationKey = useMemo(
    () => conversationIds.slice().sort((a, b) => a - b).join(','),
    [conversationIds],
  );

  useEffect(() => {
    if (!isAuthenticated || !token || !userId) {
      websocketService.disconnect();
      return;
    }

    websocketService.connect({
      token,
      userId,
      callbacks: {
        onIncomingMessage: (message: ChatMessage) => {
          useChatStore.getState().upsertIncomingMessage(message);
        },
        onIncomingNotification: (notification: NotificationItem) => {
          useNotificationStore
            .getState()
            .prependIncomingNotification(notification);
        },
        onUnreadUpdated: payload => {
          useUnreadStore
            .getState()
            .setTotalChatUnread(payload.totalChatUnread);

          if (payload.conversationId && payload.conversationUnread !== null) {
            useUnreadStore
              .getState()
              .setConversationUnread(
                payload.conversationId,
                payload.conversationUnread,
              );
          }

          if (payload.notificationUnread !== null) {
            useUnreadStore
              .getState()
              .setUnreadNotificationCount(payload.notificationUnread);
          }
        },
      },
    });

    return () => {
      websocketService.disconnect();
    };
  }, [isAuthenticated, token, userId]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const ids = stableConversationKey
      ? stableConversationKey
          .split(',')
          .map(value => Number(value))
          .filter(value => Number.isFinite(value) && value > 0)
      : [];

    websocketService.syncConversationSubscriptions(ids);
  }, [stableConversationKey, isAuthenticated]);
}
