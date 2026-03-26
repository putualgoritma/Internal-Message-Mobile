import {create} from 'zustand';

interface UnreadState {
  totalChatUnread: number;
  unreadNotificationCount: number;
  unreadByConversation: Record<number, number>;
  setTotalChatUnread: (value: number) => void;
  setUnreadNotificationCount: (value: number) => void;
  setConversationUnread: (conversationId: number, value: number) => void;
  setConversationUnreadMap: (map: Record<number, number>) => void;
}

export const useUnreadStore = create<UnreadState>(set => ({
  totalChatUnread: 0,
  unreadNotificationCount: 0,
  unreadByConversation: {},
  setTotalChatUnread: value => set({totalChatUnread: Math.max(0, value)}),
  setUnreadNotificationCount: value =>
    set({unreadNotificationCount: Math.max(0, value)}),
  setConversationUnread: (conversationId, value) =>
    set(state => ({
      unreadByConversation: {
        ...state.unreadByConversation,
        [conversationId]: Math.max(0, value),
      },
    })),
  setConversationUnreadMap: map => set({unreadByConversation: map}),
}));
