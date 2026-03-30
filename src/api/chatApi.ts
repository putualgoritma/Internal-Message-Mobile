import type {ChatMessage, Conversation, User} from '../types/models';
import {unwrapApiPayload} from '../utils/api';
import {apiClient} from './client';

interface SendMessageInput {
  conversation_id?: number;
  recipient_user_id?: number;
  content: string;
  type?: 'text' | 'system' | 'action';
}

function normalizeMessage(input: ChatMessage): ChatMessage {
  const asRecord = input as ChatMessage & {
    message_type?: ChatMessage['type'];
    sender_name?: string;
  };

  const normalizedType = asRecord.type ?? asRecord.message_type;
  const normalizedSender =
    asRecord.sender ??
    (asRecord.sender_id != null && asRecord.sender_name
      ? {
          id: Number(asRecord.sender_id),
          name: asRecord.sender_name,
        }
      : undefined);

  if (normalizedType !== asRecord.type || normalizedSender !== asRecord.sender) {
    return {
      ...asRecord,
      type: normalizedType ?? 'text',
      sender: normalizedSender,
    };
  }

  return input;
}

function normalizeConversation(input: Conversation): Conversation {
  if (!input.last_message) {
    return input;
  }

  const last = input.last_message as ChatMessage & {
    message_type?: ChatMessage['type'];
  };
  if (last.type || !last.message_type) {
    return input;
  }

  return {
    ...input,
    last_message: {
      ...last,
      type: last.message_type,
    },
  };
}

function normalizeList<T>(payload: unknown): T[] {
  const normalized = unwrapApiPayload<unknown>(payload);

  if (Array.isArray(normalized)) {
    return normalized as T[];
  }

  if (normalized && typeof normalized === 'object') {
    const asObj = normalized as Record<string, unknown>;

    if (Array.isArray(asObj.data)) {
      return asObj.data as T[];
    }

    if (Array.isArray(asObj.items)) {
      return asObj.items as T[];
    }
  }

  return [];
}

export const chatApi = {
  async getContacts(query?: string): Promise<User[]> {
    const response = await apiClient.get('/close/internal-ops/contacts', {
      params: query?.trim() ? {q: query.trim()} : undefined,
    });
    return normalizeList<User>(response.data);
  },

  async getConversations(): Promise<Conversation[]> {
    const response = await apiClient.get('/close/internal-ops/conversations');
    return normalizeList<Conversation>(response.data).map(normalizeConversation);
  },

  async getMessages(conversationId: number): Promise<ChatMessage[]> {
    const response = await apiClient.get(
      `/close/internal-ops/conversations/${conversationId}/messages`,
    );
    return normalizeList<ChatMessage>(response.data).map(normalizeMessage);
  },

  async sendMessage(payload: SendMessageInput): Promise<ChatMessage> {
    const response = await apiClient.post('/close/internal-ops/messages', {
      ...payload,
      type: payload.type ?? 'text',
    });
    return normalizeMessage(unwrapApiPayload<ChatMessage>(response.data));
  },

  async markConversationRead(conversationId: number): Promise<void> {
    await apiClient.post(
      `/close/internal-ops/conversations/${conversationId}/read`,
    );
  },

  async executeAction(endpoint: string, method: string = 'POST'): Promise<void> {
    if (method.toUpperCase() === 'POST') {
      await apiClient.post(endpoint);
    } else if (method.toUpperCase() === 'GET') {
      await apiClient.get(endpoint);
    } else if (method.toUpperCase() === 'PUT') {
      await apiClient.put(endpoint);
    } else if (method.toUpperCase() === 'DELETE') {
      await apiClient.delete(endpoint);
    } else {
      throw new Error(`Unsupported HTTP method: ${method}`);
    }
  },

  async getUnreadConversation(conversationId: number): Promise<number> {
    const response = await apiClient.get(`/close/internal-ops/unread-total`);
    const payload = unwrapApiPayload<unknown>(response.data);

    if (typeof payload === 'number') {
      return payload;
    }

    const asObj = payload as Record<string, unknown>;
    return Number(asObj.total ?? asObj.messages ?? asObj.unread_total ?? 0);
  },

  async getUnreadTotal(): Promise<number> {
    const response = await apiClient.get('/close/internal-ops/unread-total');
    const payload = unwrapApiPayload<unknown>(response.data);

    if (typeof payload === 'number') {
      return payload;
    }

    const asObj = payload as Record<string, unknown>;
    return Number(asObj.total ?? asObj.messages ?? asObj.unread_total ?? 0);
  },
};
