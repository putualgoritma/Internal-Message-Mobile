export type UserRole = 'staff' | 'manager' | 'admin' | string;

export interface User {
  id: number;
  name: string;
  email: string;
  role?: UserRole;
  manager_id?: number | null;
}

export type MessageType = 'text' | 'system' | 'action' | string;

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  type: MessageType;
  content: string;
  created_at: string;
  sender?: {
    id: number;
    name: string;
  };
}

export interface Conversation {
  id: number;
  title?: string;
  participants?: Array<{
    id: number;
    name: string;
  }>;
  last_message?: ChatMessage | null;
  unread_count?: number;
  updated_at?: string;
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

export interface ApiErrorShape {
  message?: string;
}
