import type {ChatMessage, NotificationItem} from '../types/models';

export interface NormalizedUnreadPayload {
  totalChatUnread: number;
  conversationId: number | null;
  conversationUnread: number | null;
  notificationUnread: number | null;
}

function tryParseJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    const first = tryParseJson(value);
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      return first as Record<string, unknown>;
    }

    if (typeof first === 'string') {
      const second = tryParseJson(first);
      if (second && typeof second === 'object' && !Array.isArray(second)) {
        return second as Record<string, unknown>;
      }
    }

    return null;
  }

  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readNestedObject(
  payload: unknown,
  keys: string[],
): Record<string, unknown> {
  const root = asObject(payload) ?? {};

  for (const key of keys) {
    const nested = asObject(root[key]);
    if (nested) {
      return nested;
    }
  }

  // Pusher often wraps app event payload under "data" as a JSON string.
  const nestedData = asObject(root.data);
  if (nestedData) {
    for (const key of keys) {
      const nested = asObject(nestedData[key]);
      if (nested) {
        return nested;
      }
    }

    return nestedData;
  }

  return root;
}

export function normalizeMessagePayload(payload: unknown): ChatMessage | null {
  const candidate = readNestedObject(payload, [
    'message',
    'data',
    'payload',
    'chat_message',
    'chatMessage',
  ]);

  const conversationId = asNumber(
    candidate.conversation_id ?? candidate.conversationId,
    0,
  );

  const content = asString(
    candidate.content ?? candidate.body ?? candidate.text ?? candidate.message,
    '',
  ).trim();
  if (conversationId <= 0 || !content) {
    return null;
  }

  const id = asNumber(candidate.id, Date.now());
  const senderIdRaw = candidate.sender_id ?? candidate.senderId ?? null;

  return {
    id,
    conversation_id: conversationId,
    sender_id: senderIdRaw === null ? null : asNumber(senderIdRaw, 0),
    type: asString(candidate.type, 'text'),
    content,
    created_at: asString(candidate.created_at ?? candidate.createdAt, new Date().toISOString()),
    sender: asObject(candidate.sender)
      ? {
          id: asNumber((candidate.sender as Record<string, unknown>).id, 0),
          name: asString((candidate.sender as Record<string, unknown>).name, ''),
        }
      : undefined,
  };
}

export function normalizeNotificationPayload(
  payload: unknown,
): NotificationItem | null {
  const candidate = readNestedObject(payload, ['notification', 'data', 'payload']);

  const title = asString(candidate.title, '').trim();
  const body = asString(candidate.body ?? candidate.message, '').trim();

  if (!title && !body) {
    return null;
  }

  const id = asNumber(candidate.id, Date.now());
  const isReadRaw = candidate.is_read ?? candidate.isRead ?? false;

  return {
    id,
    type: asString(candidate.type, 'system'),
    title: title || 'Notification',
    body,
    is_read: Boolean(isReadRaw),
    created_at: asString(candidate.created_at ?? candidate.createdAt, new Date().toISOString()),
    data: asObject(candidate.data) ?? {},
  };
}

export function normalizeUnreadPayload(payload: unknown): NormalizedUnreadPayload {
  const candidate = readNestedObject(payload, ['data', 'payload']);

  const total = asNumber(candidate.total ?? candidate.unread_total, 0);
  const conversationId = asNumber(
    candidate.conversation_id ?? candidate.conversationId,
    0,
  );
  const conversationUnread = asNumber(
    candidate.unread_count ?? candidate.unreadCount,
    0,
  );
  const notificationUnread = asNumber(
    candidate.notification_unread ?? candidate.notificationUnread,
    -1,
  );

  return {
    totalChatUnread: Math.max(0, total),
    conversationId: conversationId > 0 ? conversationId : null,
    conversationUnread: conversationId > 0 ? Math.max(0, conversationUnread) : null,
    notificationUnread: notificationUnread >= 0 ? notificationUnread : null,
  };
}
