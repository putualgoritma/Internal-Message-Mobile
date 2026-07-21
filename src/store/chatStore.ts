import {create} from 'zustand';

import {chatApi} from '../api/chatApi';
import {clearBadgeAndNotifications, setBadgeCount} from '../services/badgeService';
import {clearDeliveredPushNotifications} from '../services/pushService';
import type {ChatMessage, Conversation} from '../types/models';
import {toErrorMessage} from '../utils/api';
import {useAuthStore} from './authStore';
import {useUnreadStore} from './unreadStore';

interface ChatState {
  conversations: Conversation[];
  messagesByConversation: Record<number, ChatMessage[]>;
  loadingConversations: boolean;
  loadingMessages: boolean;
  sendingMessage: boolean;
  error: string | null;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: number) => Promise<void>;
  sendMessage: (conversationId: number, content: string) => Promise<void>;
  markConversationRead: (conversationId: number) => Promise<void>;
  upsertIncomingMessage: (message: ChatMessage) => void;
}

function toFallbackMessage(conversation: Conversation): ChatMessage | null {
  const last = conversation.last_message;
  if (!last) {
    return null;
  }

  const createdAt =
    typeof last.created_at === 'string' && last.created_at.trim()
      ? last.created_at
      : conversation.updated_at ?? new Date().toISOString();

  return {
    id: Number(last.id ?? Date.now()),
    conversation_id: conversation.id,
    sender_id:
      typeof last.sender_id === 'number'
        ? last.sender_id
        : last.sender && typeof last.sender.id === 'number'
          ? last.sender.id
          : null,
    type: (last.type ?? 'text') as ChatMessage['type'],
    content: String(last.content ?? '').trim(),
    created_at: createdAt,
    sender: last.sender,
    metadata: last.metadata,
  };
}

function sortByCreatedAt(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();

    if (Number.isFinite(timeA) && Number.isFinite(timeB)) {
      return timeA - timeB;
    }

    if (Number.isFinite(timeA)) {
      return -1;
    }

    if (Number.isFinite(timeB)) {
      return 1;
    }

    return (a.id ?? 0) - (b.id ?? 0);
  });
}

function messageExists(messages: ChatMessage[], messageId: number): boolean {
  const targetId = Number(messageId);
  return messages.some(item => Number(item.id) === targetId);
}

function isPendingActionMessage(
  message: ChatMessage,
  currentUserId: number | undefined,
): boolean {
  const normalizedType = String(message.type ?? 'text').trim().toLowerCase();
  const isAction =
    normalizedType === 'action' ||
    normalizedType === 'action_required' ||
    normalizedType === 'action-required';
  if (!isAction) {
    return false;
  }

  if (message.sender_id == null || message.sender_id === currentUserId) {
    return false;
  }

  const metadata =
    message.metadata &&
    typeof message.metadata === 'object' &&
    !Array.isArray(message.metadata)
      ? (message.metadata as Record<string, unknown>)
      : undefined;

  const rawStatus =
    typeof message.status === 'string'
      ? message.status
      : typeof metadata?.status === 'string'
        ? String(metadata.status)
        : '';

  const status = rawStatus.trim().toLowerCase();

  const clickedSource = message as unknown as Record<string, unknown>;
  const clickedFlagRaw = clickedSource.action_clicked;
  const clickedAtRaw = clickedSource.action_clicked_at;
  const clickedInMetadataRaw = metadata?.action_clicked;
  const clickedAtInMetadataRaw = metadata?.action_clicked_at;

  const isClicked =
    clickedFlagRaw === true ||
    clickedFlagRaw === 1 ||
    clickedFlagRaw === '1' ||
    clickedFlagRaw === 'true' ||
    clickedInMetadataRaw === true ||
    clickedInMetadataRaw === 1 ||
    clickedInMetadataRaw === '1' ||
    clickedInMetadataRaw === 'true' ||
    (typeof clickedAtRaw === 'string' && clickedAtRaw.trim().length > 0) ||
    (typeof clickedAtInMetadataRaw === 'string' &&
      clickedAtInMetadataRaw.trim().length > 0);

  if (isClicked) {
    return false;
  }

  return status === 'pending';
}

function isUnreadNormalMessage(
  message: ChatMessage,
  currentUserId: number | undefined,
): boolean {
  const normalizedType = String(message.type ?? 'text').trim().toLowerCase();
  const isAction =
    normalizedType === 'action' ||
    normalizedType === 'action_required' ||
    normalizedType === 'action-required';
  const isSystem = normalizedType === 'system' || normalizedType === 'info';
  if (isAction || isSystem) {
    return false;
  }

  if (message.sender_id == null || message.sender_id === currentUserId) {
    return false;
  }

  const isRead = message.is_read === true;
  const hasReadAt =
    typeof message.read_at === 'string' && message.read_at.trim().length > 0;

  return !isRead && !hasReadAt;
}

function countUnreadByRule(
  messages: ChatMessage[],
  currentUserId: number | undefined,
): number {
  return messages.filter(message => {
    if (isPendingActionMessage(message, currentUserId)) {
      return true;
    }

    return isUnreadNormalMessage(message, currentUserId);
  }).length;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messagesByConversation: {},
  loadingConversations: false,
  loadingMessages: false,
  sendingMessage: false,
  error: null,

  fetchConversations: async () => {
    set({loadingConversations: true, error: null});

    try {
      const conversations = await chatApi.getConversations();
      const currentUnreadMap = useUnreadStore.getState().unreadByConversation;
      const nextUnreadMap = {...currentUnreadMap};

      // Fixed rule: never use backend unread_count as source of truth.
      const mergedConversations = conversations.map(item => {
        const localUnread = currentUnreadMap[item.id] ?? 0;
        nextUnreadMap[item.id] = localUnread;
        return {...item, unread_count: localUnread};
      });

      useUnreadStore.getState().setConversationUnreadMap(nextUnreadMap);
      setBadgeCount(useUnreadStore.getState().totalChatUnread);

      const sortedConversations = [...mergedConversations].sort((a, b) => {
        const tA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tB - tA;
      });

      set({conversations: sortedConversations});

      // Reconcile all conversation counters from real pending action buttons.
      const currentUserId = useAuthStore.getState().user?.id;
      void (async () => {
        const result = await Promise.all(
          sortedConversations.map(async item => {
            try {
              const messages = await chatApi.getMessages(item.id);
                  const unread = countUnreadByRule(messages, currentUserId);
                  return {conversationId: item.id, unread};
            } catch {
              return null;
            }
          }),
        );

        const reconciled = result.filter(
              (item): item is {conversationId: number; unread: number} => item !== null,
        );

        if (reconciled.length === 0) {
          return;
        }

        const unreadMap = {...useUnreadStore.getState().unreadByConversation};
        for (const item of reconciled) {
              unreadMap[item.conversationId] = item.unread;
        }

        useUnreadStore.getState().setConversationUnreadMap(unreadMap);
        setBadgeCount(useUnreadStore.getState().totalChatUnread);

        set(state => ({
          conversations: state.conversations.map(conversation => ({
            ...conversation,
            unread_count: unreadMap[conversation.id] ?? 0,
          })),
        }));
      })();
    } catch (error) {
      set({error: toErrorMessage(error)});
    } finally {
      set({loadingConversations: false});
    }
  },

  fetchMessages: async (conversationId: number) => {
    set({loadingMessages: true, error: null});

    try {
      const messages = await chatApi.getMessages(conversationId);
      const sortedMessages = sortByCreatedAt(messages);
      set(state => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: sortedMessages,
        },
      }));

      const currentUserId = useAuthStore.getState().user?.id;
      const unreadByRule = countUnreadByRule(sortedMessages, currentUserId);
      useUnreadStore.getState().setConversationUnread(conversationId, unreadByRule);
      setBadgeCount(useUnreadStore.getState().totalChatUnread);

      set(state => ({
        conversations: state.conversations.map(item =>
          item.id === conversationId
            ? {...item, unread_count: unreadByRule}
            : item,
        ),
      }));
    } catch (error) {
      const fallbackConversation = get().conversations.find(
        item => item.id === conversationId,
      );
      const fallbackMessage = fallbackConversation
        ? toFallbackMessage(fallbackConversation)
        : null;

      set(state => ({
        error: toErrorMessage(error),
        messagesByConversation: fallbackMessage
          ? {
              ...state.messagesByConversation,
              [conversationId]: sortByCreatedAt([fallbackMessage]),
            }
          : state.messagesByConversation,
      }));
    } finally {
      set({loadingMessages: false});
    }
  },

  sendMessage: async (conversationId: number, content: string) => {
    if (!content.trim()) {
      return;
    }

    set({sendingMessage: true, error: null});
    try {
      const newMessage = await chatApi.sendMessage({
        conversation_id: conversationId,
        content: content.trim(),
        type: 'text',
      });
      get().upsertIncomingMessage(newMessage);
    } catch (error) {
      set({error: toErrorMessage(error)});
      throw error;
    } finally {
      set({sendingMessage: false});
    }
  },

  markConversationRead: async (conversationId: number) => {
    const currentUserId = useAuthStore.getState().user?.id;
    const messages = get().messagesByConversation[conversationId] ?? [];
    const unreadByRule = countUnreadByRule(messages, currentUserId);

    useUnreadStore
      .getState()
      .setConversationUnread(conversationId, unreadByRule);
    const totalUnreadAfterUpdate = useUnreadStore.getState().totalChatUnread;
    setBadgeCount(totalUnreadAfterUpdate);

    if (unreadByRule === 0 && totalUnreadAfterUpdate === 0) {
      clearBadgeAndNotifications();
      clearDeliveredPushNotifications();
    }

    set(state => ({
      conversations: state.conversations.map(item =>
        item.id === conversationId
          ? {...item, unread_count: unreadByRule}
          : item,
      ),
    }));

    if (unreadByRule > 0) {
      return;
    }

    try {
      await chatApi.markConversationRead(conversationId);
    } catch (error) {
      set({error: toErrorMessage(error)});
    }
  },

  upsertIncomingMessage: (message: ChatMessage) => {
    const snapshot = get().messagesByConversation[message.conversation_id] ?? [];

    if (messageExists(snapshot, message.id)) {
      const currentUserId = useAuthStore.getState().user?.id;
      let unreadAfterUpdate = 0;

      set(state => {
        const conversationId = message.conversation_id;
        const current = state.messagesByConversation[conversationId] ?? [];
        const updated = current.map(m => (m.id === message.id ? {...m, ...message} : m));
        unreadAfterUpdate = countUnreadByRule(
          updated,
          currentUserId,
        );
        return {
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: updated,
          },
          conversations: state.conversations.map(item =>
            item.id === conversationId
              ? {...item, unread_count: unreadAfterUpdate}
              : item,
          ),
        };
      });

      useUnreadStore
        .getState()
        .setConversationUnread(message.conversation_id, unreadAfterUpdate);
      setBadgeCount(useUnreadStore.getState().totalChatUnread);

      return;
    }

    const conversationId = message.conversation_id;
    const currentUserId = useAuthStore.getState().user?.id;
    const shouldIncrement =
      isPendingActionMessage(message, currentUserId) ||
      isUnreadNormalMessage(message, currentUserId);

    if (shouldIncrement) {
      const currentUnread =
        useUnreadStore.getState().unreadByConversation[conversationId] ?? 0;
      useUnreadStore
        .getState()
        .setConversationUnread(conversationId, currentUnread + 1);
      setBadgeCount(useUnreadStore.getState().totalChatUnread);
    }

    set(state => {
      const current = state.messagesByConversation[conversationId] ?? [];
      if (messageExists(current, message.id)) {
        return state;
      }
      const updatedMessages = sortByCreatedAt([...current, message]);

      let foundConversation = false;
      const updatedConversations = state.conversations.map(item => {
        if (item.id !== conversationId) {
          return item;
        }
        foundConversation = true;
        return {
          ...item,
          last_message: message,
          updated_at: message.created_at,
        };
      });

      const mergedConversations = foundConversation
        ? updatedConversations
        : [
            {
              id: conversationId,
              last_message: message,
              unread_count: shouldIncrement ? 1 : 0,
              updated_at: message.created_at,
            },
            ...updatedConversations,
          ];

      const sorted = [...mergedConversations].sort((a, b) => {
        const tA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tB - tA;
      });

      return {
        conversations: sorted,
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: updatedMessages,
        },
      };
    });
  },
}));
