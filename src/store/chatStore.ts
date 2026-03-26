import {create} from 'zustand';

import {chatApi} from '../api/chatApi';
import type {ChatMessage, Conversation} from '../types/models';
import {toErrorMessage} from '../utils/api';
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

function toConversationUnreadMap(
  conversations: Conversation[],
): Record<number, number> {
  return conversations.reduce<Record<number, number>>((acc, item) => {
    acc[item.id] = Number(item.unread_count ?? 0);
    return acc;
  }, {});
}

function sortByCreatedAt(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
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
      const totalUnread = await chatApi.getUnreadTotal();

      useUnreadStore
        .getState()
        .setConversationUnreadMap(toConversationUnreadMap(conversations));
      useUnreadStore.getState().setTotalChatUnread(totalUnread);

      set({conversations});
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
      set(state => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: sortByCreatedAt(messages),
        },
      }));
    } catch (error) {
      set({error: toErrorMessage(error)});
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
    const unreadByConversation = useUnreadStore.getState().unreadByConversation;
    const previousUnread = unreadByConversation[conversationId] ?? 0;

    try {
      await chatApi.markConversationRead(conversationId);
      useUnreadStore.getState().setConversationUnread(conversationId, 0);

      const totalUnread = useUnreadStore.getState().totalChatUnread;
      useUnreadStore
        .getState()
        .setTotalChatUnread(Math.max(0, totalUnread - previousUnread));
    } catch (error) {
      set({error: toErrorMessage(error)});
    }
  },

  upsertIncomingMessage: (message: ChatMessage) => {
    const conversationId = message.conversation_id;
    const existing = get().messagesByConversation[conversationId] ?? [];

    if (messageExists(existing, message.id)) {
      return;
    }

    set(state => {
      const updatedMessages = sortByCreatedAt([...existing, message]);
      const conversations = state.conversations.map(item => {
        if (item.id !== conversationId) {
          return item;
        }

        return {
          ...item,
          last_message: message,
          updated_at: message.created_at,
        };
      });

      return {
        conversations,
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: updatedMessages,
        },
      };
    });
  },
}));
