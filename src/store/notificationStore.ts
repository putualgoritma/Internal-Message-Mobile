import {create} from 'zustand';

import {notificationApi} from '../api/notificationApi';
import type {NotificationItem} from '../types/models';
import {toErrorMessage} from '../utils/api';
import {useUnreadStore} from './unreadStore';

interface NotificationState {
  notifications: NotificationItem[];
  loading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markRead: (notificationId: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  prependIncomingNotification: (item: NotificationItem) => void;
}

function computeUnreadCount(notifications: NotificationItem[]): number {
  return notifications.filter(item => !item.is_read).length;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  loading: false,
  error: null,

  fetchNotifications: async () => {
    set({loading: true, error: null});

    try {
      const notifications = await notificationApi.getNotifications();
      useUnreadStore
        .getState()
        .setUnreadNotificationCount(computeUnreadCount(notifications));
      set({notifications});
    } catch (error) {
      set({error: toErrorMessage(error)});
    } finally {
      set({loading: false});
    }
  },

  markRead: async (notificationId: number) => {
    try {
      await notificationApi.markAsRead(notificationId);

      set(state => {
        const updated = state.notifications.map(item =>
          item.id === notificationId ? {...item, is_read: true} : item,
        );
        useUnreadStore
          .getState()
          .setUnreadNotificationCount(computeUnreadCount(updated));
        return {notifications: updated};
      });
    } catch (error) {
      set({error: toErrorMessage(error)});
    }
  },

  markAllRead: async () => {
    try {
      const pending = get().notifications.filter(item => !item.is_read);
      if (pending.length) {
        await Promise.all(
          pending.map(item =>
            notificationApi.markAsRead(item.id).catch(() => null),
          ),
        );
      }
      const updated = get().notifications.map(item => ({
        ...item,
        is_read: true,
      }));
      useUnreadStore.getState().setUnreadNotificationCount(0);
      set({notifications: updated});
    } catch (error) {
      set({error: toErrorMessage(error)});
    }
  },

  prependIncomingNotification: (item: NotificationItem) => {
    set(state => {
      const exists = state.notifications.some(existing => existing.id === item.id);
      if (exists) {
        return state;
      }

      const updated = [item, ...state.notifications];
      useUnreadStore
        .getState()
        .setUnreadNotificationCount(computeUnreadCount(updated));
      return {notifications: updated};
    });
  },
}));
