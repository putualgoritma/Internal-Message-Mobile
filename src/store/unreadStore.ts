import {create} from 'zustand';

function sumUnreadMap(map: Record<number, number>): number {
  return Object.values(map).reduce((total, value) => total + Math.max(0, value), 0);
}

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
    set(state => {
      const unreadByConversation = {
        ...state.unreadByConversation,
        [conversationId]: Math.max(0, value),
      };

      return {
        unreadByConversation,
        totalChatUnread: sumUnreadMap(unreadByConversation),
      };
    }),
  setConversationUnreadMap: map =>
    set({
      unreadByConversation: map,
      totalChatUnread: sumUnreadMap(map),
    }),
}));
