import {useEffect, useMemo} from 'react';

import {useAuthStore} from '../store/authStore';
import {useChatStore} from '../store/chatStore';
import {useNotificationStore} from '../store/notificationStore';
import {useUnreadStore} from '../store/unreadStore';
import {websocketService} from '../services/websocketService';
import {
  playIncomingMessageSound,
  preloadIncomingMessageSound,
} from '../services/messageSound';
import type {ChatMessage, NotificationItem} from '../types/models';

export function useRealtime(): void {
  const token = useAuthStore(state => state.token);
  const userId = useAuthStore(state => state.user?.id);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const conversations = useChatStore(state => state.conversations);
  const messagesByConversation = useChatStore(
    state => state.messagesByConversation,
  );
  const conversationIds = useMemo(() => {
    const fromConversations = conversations.map(item => item.id);
    const fromLoadedMessageBuckets = Object.keys(messagesByConversation)
      .map(value => Number(value))
      .filter(value => Number.isFinite(value) && value > 0);

    return Array.from(new Set([...fromConversations, ...fromLoadedMessageBuckets]));
  }, [conversations, messagesByConversation]);

  const stableConversationKey = useMemo(
    () => conversationIds.slice().sort((a, b) => a - b).join(','),
    [conversationIds],
  );

  useEffect(() => {
    let lastFallbackSyncAt = 0;

    if (!isAuthenticated || !token || !userId) {
      websocketService.disconnect();
      return;
    }

    preloadIncomingMessageSound();

    websocketService.connect({
      token,
      userId,
      callbacks: {
        onIncomingMessage: (message: ChatMessage) => {
          try {
            console.log('[Realtime] onIncomingMessage called for message:', message.id);
            if (message.sender_id != null && message.sender_id !== userId) {
              console.log('[Realtime] Playing sound for message from sender:', message.sender_id);
              playIncomingMessageSound();
            }
            console.log('[Realtime] Upserting message to store');
            useChatStore.getState().upsertIncomingMessage(message);
            console.log('[Realtime] Message upserted');
          } catch (error) {
            console.error('[Realtime] Error handling incoming message:', error);
          }
        },
        onIncomingNotification: (notification: NotificationItem) => {
          useNotificationStore
            .getState()
            .prependIncomingNotification(notification);
        },
        onUnreadUpdated: payload => {
          if (payload.conversationId && payload.conversationUnread !== null) {
            useUnreadStore
              .getState()
              .setConversationUnread(
                payload.conversationId,
                payload.conversationUnread,
              );

            // Fallback path: some backends only emit unread events and not message events.
            // Pull the latest messages so Chat Room updates without manual refresh.
            useChatStore
              .getState()
              .fetchMessages(payload.conversationId)
              .catch(() => {
                // Store captures error state.
              });
          } else {
            useUnreadStore
              .getState()
              .setTotalChatUnread(payload.totalChatUnread);
          }

          // Keep chat list in sync even if message event names differ server-side.
          useChatStore
            .getState()
            .fetchConversations()
            .catch(() => {
              // Store captures error state.
            });

          if (payload.notificationUnread !== null) {
            useUnreadStore
              .getState()
              .setUnreadNotificationCount(payload.notificationUnread);
          }
        },
        onAnyRealtimeEvent: () => {
          const now = Date.now();
          if (now - lastFallbackSyncAt < 1000) {
            return;
          }

          lastFallbackSyncAt = now;
          useChatStore
            .getState()
            .fetchConversations()
            .catch(() => {
              // Store captures error state.
            });
        },
      },
    });

    // Prime conversations so realtime subscription has channel IDs early.
    useChatStore
      .getState()
      .fetchConversations()
      .catch(() => {
        // Store captures error state.
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
