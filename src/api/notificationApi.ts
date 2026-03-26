import type {NotificationItem} from '../types/models';
import {unwrapApiPayload} from '../utils/api';
import {apiClient} from './client';

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

export const notificationApi = {
  async getNotifications(): Promise<NotificationItem[]> {
    const response = await apiClient.get('/close/internal-ops/notifications');
    return normalizeList<NotificationItem>(response.data);
  },

  async markAsRead(notificationId: number): Promise<void> {
    await apiClient.post(
      `/close/internal-ops/notifications/${notificationId}/read`,
    );
  },

  async markAllAsRead(): Promise<void> {
    await apiClient.post('/close/internal-ops/notifications/read-all');
  },
};
