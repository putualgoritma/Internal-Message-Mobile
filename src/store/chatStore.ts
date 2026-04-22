import {create} from 'zustand';

import {chatApi} from '../api/chatApi';
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

function toConversationUnreadMap(
  conversations: Conversation[],
): Record<number, number> {
  return conversations.reduce<Record<number, number>>((acc, item) => {
    acc[item.id] = Number(item.unread_count ?? 0);
    return acc;
  }, {});
}

function sortByCreatedAt(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();

    // If both timestamps are valid, sort by time (ascending - oldest first)
    if (Number.isFinite(timeA) && Number.isFinite(timeB)) {
      return timeA - timeB;
    }

    // If only A is valid, A comes first
    if (Number.isFinite(timeA)) {
      return -1;
    }

    // If only B is valid, B comes first
    if (Number.isFinite(timeB)) {
      return 1;
    }

    // If neither is valid, fall back to ID ordering
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

function messageExists(messages: ChatMessage[], messageId: number): boolean {
  return messages.some(item => item.id === messageId);
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

      const mergedConversations = conversations.map(item => {
        const serverUnread = Number(item.unread_count ?? 0);
        const localUnread = currentUnreadMap[item.id]; // undefined = never set locally

        if (localUnread === undefined) {
          // No local state yet — trust server
          return item;
        }
        if (localUnread === 0) {
          // User explicitly marked as read — keep 0 regardless of server lag
          return {...item, unread_count: 0};
        }
        // WS has incremented locally — take the higher value so badge never goes backwards
        return {...item, unread_count: Math.max(localUnread, serverUnread)};
      });

      useUnreadStore
        .getState()
        .setConversationUnreadMap(toConversationUnreadMap(mergedConversations));

      const sortedConversations = [...mergedConversations].sort((a, b) => {
        const tA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tB - tA;
      });

      set({conversations: sortedConversations});
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
      console.log(
        `[fetchMessages] conv=${conversationId} count=${messages.length}`,
        messages.map(m => ({id: m.id, type: m.type, status: m.status, metadata_status: (m.metadata as Record<string,unknown>)?.status})),
      );
      set(state => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: sortByCreatedAt(messages),
        },
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
    // Optimistically clear badge immediately — don't wait for API
    useUnreadStore.getState().setConversationUnread(conversationId, 0);
    set(state => ({
      conversations: state.conversations.map(item =>
        item.id === conversationId ? {...item, unread_count: 0} : item,
      ),
    }));

    try {
      await chatApi.markConversationRead(conversationId);
    } catch (error) {
      set({error: toErrorMessage(error)});
    }
  },

  upsertIncomingMessage: (message: ChatMessage) => {
    const snapshot = get().messagesByConversation[message.conversation_id] ?? [];

    // If message already exists, update it in-place (e.g. status changed to 'closed')
    if (messageExists(snapshot, message.id)) {
      set(state => {
        const conversationId = message.conversation_id;
        const current = state.messagesByConversation[conversationId] ?? [];
        const updated = current.map(m => (m.id === message.id ? {...m, ...message} : m));
        return {
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: updated,
          },
        };
      });
      return;
    }

    const conversationId = message.conversation_id;

    // Increment badge for messages arriving from other users
    const currentUserId = useAuthStore.getState().user?.id;
    if (message.sender_id != null && message.sender_id !== currentUserId) {
      const currentUnread =
        useUnreadStore.getState().unreadByConversation[conversationId] ?? 0;
      useUnreadStore
        .getState()
        .setConversationUnread(conversationId, currentUnread + 1);
    }

    set(state => {
      // Use state inside set() to avoid stale closure over `existing`
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
              unread_count:
                message.sender_id != null && message.sender_id !== currentUserId ? 1 : 0,
              updated_at: message.created_at,
            },
            ...updatedConversations,
          ];

      // Bubble updated conversation to the top of the list
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
