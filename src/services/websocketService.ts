import Echo from 'laravel-echo';
import Pusher from 'pusher-js/react-native';

import {APP_CONFIG} from '../config/appConfig';
import type {ChatMessage, NotificationItem} from '../types/models';
import {
  normalizeMessagePayload,
  normalizeNotificationPayload,
  normalizeUnreadPayload,
  type NormalizedUnreadPayload,
} from './realtimePayload';
import {useRealtimeStore} from '../store/realtimeStore';

interface RealtimeCallbacks {
  onIncomingMessage: (message: ChatMessage) => void;
  onIncomingNotification: (notification: NotificationItem) => void;
  onUnreadUpdated: (payload: NormalizedUnreadPayload) => void;
}

interface RealtimeConnectInput {
  token: string;
  userId: number;
  callbacks: RealtimeCallbacks;
}

const MESSAGE_EVENTS = [
  'internal-ops.message.sent',
  '.internal-ops.message.sent',
  'MessageSent',
  '.MessageSent',
  'InternalOpsMessageSent',
];
const NOTIFICATION_EVENTS = [
  'internal-ops.notification.created',
  '.internal-ops.notification.created',
  'NotificationCreated',
  '.NotificationCreated',
  'InternalOpsNotificationCreated',
];
const UNREAD_EVENTS = ['UnreadUpdated', '.UnreadUpdated'];

class WebsocketService {
  private echo: Echo<'pusher'> | null = null;
  private callbacks: RealtimeCallbacks | null = null;
  private userId: number | null = null;
  private conversationIds = new Set<number>();

  connect(input: RealtimeConnectInput): void {
    this.disconnect();
    useRealtimeStore.getState().setStatus('connecting');
    useRealtimeStore.getState().setLastEvent('realtime.connect.init');

    this.callbacks = input.callbacks;
    this.userId = input.userId;

    const PusherCtor =
      (Pusher as unknown as {default?: typeof Pusher}).default ?? Pusher;
    const pusherOptions = {
      cluster: APP_CONFIG.wsCluster,
      wsHost: APP_CONFIG.wsHost,
      wsPort: APP_CONFIG.wsPort,
      wssPort: APP_CONFIG.wsPort,
      wsPath: APP_CONFIG.wsPath,
      forceTLS: APP_CONFIG.wsScheme === 'https',
      enabledTransports: ['ws', 'wss'] as ('ws' | 'wss')[],
      disableStats: true,
      authEndpoint: APP_CONFIG.broadcastAuthUrl,
      auth: {
        headers: {
          Authorization: `Bearer ${input.token}`,
          Accept: 'application/json',
        },
      },
    };
    const pusherClient = new PusherCtor(APP_CONFIG.wsAppKey, pusherOptions);

    this.echo = new Echo({
      broadcaster: 'pusher',
      key: APP_CONFIG.wsAppKey,
      ...pusherOptions,
      client: pusherClient,
    });

    this.bindConnectionLifecycle();
    this.subscribeUserChannel(input.userId);
  }

  syncConversationSubscriptions(conversationIds: number[]): void {
    if (!this.echo) {
      return;
    }

    const nextIds = new Set(conversationIds);

    for (const id of this.conversationIds) {
      if (!nextIds.has(id)) {
        this.echo.leave(`internal-ops.conversation.${id}`);
      }
    }

    for (const id of nextIds) {
      if (!this.conversationIds.has(id)) {
        this.subscribeConversationChannel(id);
      }
    }

    this.conversationIds = nextIds;
  }

  disconnect(): void {
    if (this.echo) {
      this.echo.disconnect();
    }

    this.echo = null;
    this.callbacks = null;
    this.userId = null;
    this.conversationIds.clear();
    useRealtimeStore.getState().setStatus('disconnected');
    useRealtimeStore.getState().setLastEvent('realtime.disconnect');
  }

  private bindConnectionLifecycle(): void {
    if (!this.echo) {
      return;
    }

    const connector = this.echo.connector as unknown as {
      pusher?: {
        connection?: {
          bind?: (eventName: string, callback: (payload: unknown) => void) => void;
        };
      };
    };

    const connection = connector?.pusher?.connection;
    if (!connection?.bind) {
      return;
    }

    connection.bind('connected', () => {
      useRealtimeStore.getState().setStatus('connected');
      useRealtimeStore.getState().setLastEvent('connection.connected');
    });

    connection.bind('disconnected', () => {
      useRealtimeStore.getState().setStatus('disconnected');
      useRealtimeStore.getState().setLastEvent('connection.disconnected');
    });

    connection.bind('error', () => {
      useRealtimeStore.getState().setStatus('error');
      useRealtimeStore.getState().setLastEvent('connection.error');
    });
  }

  private subscribeUserChannel(userId: number): void {
    if (!this.echo) {
      return;
    }

    const userChannel = this.echo.private(`internal-ops.user.${userId}`);

    for (const eventName of NOTIFICATION_EVENTS) {
      userChannel.listen(eventName, (payload: unknown) => {
        useRealtimeStore
          .getState()
          .setLastEvent(`internal-ops.user.${userId}:${eventName}`);
        const notification = normalizeNotificationPayload(payload);
        if (notification) {
          this.callbacks?.onIncomingNotification(notification);
        }
      });
    }

    for (const eventName of UNREAD_EVENTS) {
      userChannel.listen(eventName, (payload: unknown) => {
        useRealtimeStore
          .getState()
          .setLastEvent(`internal-ops.user.${userId}:${eventName}`);
        this.callbacks?.onUnreadUpdated(normalizeUnreadPayload(payload));
      });
    }
  }

  private subscribeConversationChannel(conversationId: number): void {
    if (!this.echo) {
      return;
    }

    const channel = this.echo.private(
      `internal-ops.conversation.${conversationId}`,
    );

    for (const eventName of MESSAGE_EVENTS) {
      channel.listen(eventName, (payload: unknown) => {
        useRealtimeStore
          .getState()
          .setLastEvent(`internal-ops.conversation.${conversationId}:${eventName}`);
        const message = normalizeMessagePayload(payload);
        if (message) {
          this.callbacks?.onIncomingMessage(message);
        }
      });
    }
  }
}

export const websocketService = new WebsocketService();
