import type {ChatMessage, Conversation, User} from '../types/models';
import {unwrapApiPayload} from '../utils/api';
import {apiClient} from './client';

interface SendMessageInput {
  conversation_id?: number;
  recipient_user_id?: number;
  content: string;
  type?: 'text' | 'system' | 'action';
}

function parseMetadata(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore invalid JSON metadata and keep original payload untouched.
  }

  return undefined;
}

function normalizeMessageType(value: unknown): ChatMessage['type'] {
  const raw = String(value ?? 'text').trim().toLowerCase();

  if (raw === 'action' || raw === 'action_required' || raw === 'action-required') {
    return 'action';
  }

  if (raw === 'system' || raw === 'info') {
    return 'system';
  }

  if (!raw) {
    return 'text';
  }

  return raw;
}

function pickMessageText(
  value: unknown,
  type: ChatMessage['type'],
  metadata?: Record<string, unknown>,
): string {
  const raw = String(value ?? '').trim();
  const looksLikePlaceholder = /^there is no message\.?$/i.test(raw);
  if (raw && !looksLikePlaceholder) {
    return raw;
  }

  const fromMetadata = [
    metadata?.message,
    metadata?.title,
    metadata?.text,
    metadata?.prompt,
    metadata?.description,
  ]
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .find(Boolean);

  if (fromMetadata) {
    return fromMetadata;
  }

  return type === 'action' ? 'Action required' : raw;
}

function normalizeMessage(input: ChatMessage): ChatMessage {
  const asRecord = input as ChatMessage & {
    message_type?: ChatMessage['type'];
    sender_name?: string;
    metadata?: unknown;
  };

  const normalizedType = normalizeMessageType(asRecord.type ?? asRecord.message_type);
  const normalizedMetadata = parseMetadata(asRecord.metadata) ?? asRecord.metadata;
  const normalizedContent = pickMessageText(
    asRecord.content,
    normalizedType,
    normalizedMetadata as Record<string, unknown> | undefined,
  );
  const normalizedSender =
    asRecord.sender ??
    (asRecord.sender_id != null && asRecord.sender_name
      ? {
          id: Number(asRecord.sender_id),
          name: asRecord.sender_name,
        }
      : undefined);

  if (
    normalizedType !== asRecord.type ||
    normalizedSender !== asRecord.sender ||
    normalizedContent !== asRecord.content ||
    normalizedMetadata !== asRecord.metadata
  ) {
    return {
      ...asRecord,
      type: normalizedType,
      content: normalizedContent,
      sender: normalizedSender,
      metadata: normalizedMetadata,
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
  const normalizedType = normalizeMessageType(last.type ?? last.message_type);
  const normalizedMetadata = parseMetadata(last.metadata) ?? last.metadata;
  const normalizedContent = pickMessageText(
    last.content,
    normalizedType,
    normalizedMetadata as Record<string, unknown> | undefined,
  );

  const hasChange =
    normalizedType !== last.type ||
    normalizedContent !== last.content ||
    normalizedMetadata !== last.metadata;

  if (!hasChange) {
    return input;
  }

  return {
    ...input,
    last_message: {
      ...last,
      type: normalizedType,
      content: normalizedContent,
      metadata: normalizedMetadata,
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

function resolveActionUrl(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const base = apiClient.defaults.baseURL ?? '';
  if (!base) {
    return trimmed;
  }

  try {
    const baseUrl = new URL(base);

    if (/^\/?api\//i.test(trimmed)) {
      return new URL(trimmed.replace(/^\/?/, '/'), baseUrl.origin).toString();
    }

    if (trimmed.startsWith('/')) {
      return new URL(trimmed, baseUrl.origin).toString();
    }
  } catch {
    // Fall back to generic URL resolution below.
  }

  try {
    return new URL(trimmed, base.endsWith('/') ? base : `${base}/`).toString();
  } catch {
    return `${base.replace(/\/$/, '')}/${trimmed.replace(/^\//, '')}`;
  }
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
    const normalizedMethod = method.toUpperCase();
    const resolvedUrl = resolveActionUrl(endpoint);

    console.log(
      `[Action] executeAction ${normalizedMethod} raw="${endpoint}" resolved="${resolvedUrl}"`,
    );

    try {
      if (normalizedMethod === 'POST') {
        await apiClient.post(resolvedUrl);
      } else if (normalizedMethod === 'GET') {
        await apiClient.get(resolvedUrl);
      } else if (normalizedMethod === 'PUT') {
        await apiClient.put(resolvedUrl);
      } else if (normalizedMethod === 'DELETE') {
        await apiClient.delete(resolvedUrl);
      } else {
        throw new Error(`Unsupported HTTP method: ${method}`);
      }
    } catch (error) {
      console.error(
        `[Action] executeAction failed ${normalizedMethod} resolved="${resolvedUrl}"`,
        error,
      );
      throw error;
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
