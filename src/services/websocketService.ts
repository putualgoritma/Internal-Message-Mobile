import axios from 'axios';
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
  onAnyRealtimeEvent?: (eventName: string) => void;
}

interface RealtimeConnectInput {
  token: string;
  userId: number;
  callbacks: RealtimeCallbacks;
}

type ChannelAuthPayload = {
  auth: string;
  [key: string]: unknown;
};

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
const KNOWN_EVENT_NAMES = new Set([
  ...MESSAGE_EVENTS,
  ...NOTIFICATION_EVENTS,
  ...UNREAD_EVENTS,
]);

class WebsocketService {
  private echo: Echo<'pusher'> | null = null;
  private pusherClient: InstanceType<typeof Pusher> | null = null;
  private callbacks: RealtimeCallbacks | null = null;
  private userId: number | null = null;
  private conversationIds = new Set<number>();
  private recentlyHandledMessageIds = new Map<number, number>();

  private pruneHandledMessageCache(now: number): void {
    const maxAgeMs = 15000;
    for (const [id, timestamp] of this.recentlyHandledMessageIds.entries()) {
      if (now - timestamp > maxAgeMs) {
        this.recentlyHandledMessageIds.delete(id);
      }
    }
  }

  private emitIncomingMessage(message: ChatMessage, source: string): void {
    const messageId = Number(message.id);
    if (!Number.isFinite(messageId) || messageId <= 0) {
      this.callbacks?.onIncomingMessage(message);
      return;
    }

    const now = Date.now();
    this.pruneHandledMessageCache(now);

    const lastHandledAt = this.recentlyHandledMessageIds.get(messageId);
    if (lastHandledAt && now - lastHandledAt < 15000) {
      console.log('[WS] duplicate incoming message skipped:', messageId, source);
      return;
    }

    this.recentlyHandledMessageIds.set(messageId, now);
    this.callbacks?.onIncomingMessage(message);
  }

  private extractAuthPayload(payload: unknown): ChannelAuthPayload | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const root = payload as Record<string, unknown>;
    const directAuth = root.auth;
    if (typeof directAuth === 'string' && directAuth.length > 0) {
      return root as ChannelAuthPayload;
    }

    const nested = root.data;
    if (nested && typeof nested === 'object') {
      const nestedObj = nested as Record<string, unknown>;
      const nestedAuth = nestedObj.auth;
      if (typeof nestedAuth === 'string' && nestedAuth.length > 0) {
        return nestedObj as ChannelAuthPayload;
      }
    }

    return null;
  }

  connect(input: RealtimeConnectInput): void {
    console.log('[WS] connect() called, userId=' + input.userId);
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
      authorizer: (channel: {name: string}) => ({
        authorize: (
          socketId: string,
          callback: (
            error: Error | null,
            data: ChannelAuthPayload,
          ) => void,
        ) => {
          const endpoint = APP_CONFIG.broadcastAuthUrl;

          void (async () => {
            let lastMessage = 'Unable to retrieve auth string from channel-authorization endpoint.';

            try {
              // Use axios (same SSL stack as API calls) instead of native fetch.
              // Laravel broadcasting/auth expects form-urlencoded body.
              const {data, status} = await axios.post<unknown>(
                endpoint,
                `socket_id=${encodeURIComponent(socketId)}&channel_name=${encodeURIComponent(channel.name)}`,
                {
                  headers: {
                    Authorization: `Bearer ${input.token}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  validateStatus: () => true,
                },
              );

              const authPayload = this.extractAuthPayload(data);
              console.log(
                '[WS] auth response:',
                endpoint,
                status,
                JSON.stringify(data).slice(0, 200),
              );

              if (status >= 200 && status < 300 && authPayload) {
                console.log('[WS] channel auth success:', channel.name);
                callback(null, authPayload);
                return;
              }

              const parsed = data as Record<string, unknown> | null;
              const message =
                (parsed && typeof parsed.message === 'string' ? parsed.message : undefined) ??
                `HTTP ${status}`;
              lastMessage = `${message} @ ${endpoint}`;
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              console.log('[WS] channel auth exception:', channel.name, endpoint, msg);
              lastMessage = `${msg} @ ${endpoint}`;
            }

            console.log('[WS] channel auth failed:', channel.name, lastMessage);
            useRealtimeStore
              .getState()
              .setLastEvent(`sub_error:${channel.name}:${String(lastMessage).slice(0, 80)}`);
            callback(new Error(lastMessage), {auth: ''});
          })();
        },
      }),
    };
    const pusherClient = new PusherCtor(APP_CONFIG.wsAppKey, pusherOptions);
    this.pusherClient = pusherClient;

    // Log every raw Pusher event so Dashboard shows what the server actually sends.
    (pusherClient as unknown as {bind_global?: (cb: (ev: string, data: unknown) => void) => void})
      .bind_global?.((eventName: string, data: unknown) => {
        try {
          // Always log pusher: protocol events (they reveal connection/auth status)
          if (eventName.startsWith('pusher:') || eventName.startsWith('pusher_internal:subscription_error')) {
            const snippet = data ? JSON.stringify(data).slice(0, 120) : '';
            useRealtimeStore.getState().setLastEvent(`raw:${eventName}${snippet ? ':' + snippet : ''}`);
          } else if (!eventName.startsWith('pusher_internal:')) {
            const snippet = data ? JSON.stringify(data).slice(0, 120) : '';
            useRealtimeStore.getState().setLastEvent(`raw:${eventName}${snippet ? ':' + snippet : ''}`);
            console.log('[WS] raw app event:', eventName, snippet);
            this.callbacks?.onAnyRealtimeEvent?.(eventName);

            // Avoid double-handling events that are already handled by channel listeners.
            if (KNOWN_EVENT_NAMES.has(eventName)) {
              return;
            }

            // Fallback path: some backends emit different event names than expected.
            // Parse payload from global events so chat list + badges still update in realtime.
            const message = normalizeMessagePayload(data);
            if (message) {
              this.emitIncomingMessage(message, `global:${eventName}`);
              return;
            }

            const unread = normalizeUnreadPayload(data);
            if (
              unread.conversationId !== null ||
              unread.notificationUnread !== null ||
              unread.totalChatUnread > 0
            ) {
              this.callbacks?.onUnreadUpdated(unread);
              return;
            }

            const notification = normalizeNotificationPayload(data);
            if (notification) {
              this.callbacks?.onIncomingNotification(notification);
            }
          }
        } catch (err) {
          console.error('[WS] Error handling global event:', eventName, err);
        }
      });

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
    this.pusherClient = null;
    this.callbacks = null;
    this.userId = null;
    this.conversationIds.clear();
    this.recentlyHandledMessageIds.clear();
    useRealtimeStore.getState().setStatus('disconnected');
    useRealtimeStore.getState().setLastEvent('realtime.disconnect');
  }

  private bindConnectionLifecycle(): void {
    if (!this.pusherClient) {
      return;
    }

    // Use pusherClient.connection directly — more reliable than echo.connector indirection
    const connection = (this.pusherClient as unknown as {
      connection?: {
        bind: (event: string, cb: (data: unknown) => void) => void;
        state?: string;
      };
    }).connection;

    if (!connection) {
      console.log('[WS] bindConnectionLifecycle: NO connection object on pusherClient!');
      useRealtimeStore.getState().setLastEvent('lifecycle_bind_failed:no_connection_object');
      return;
    }

    console.log('[WS] bindConnectionLifecycle: binding state_change to', APP_CONFIG.wsHost + ':' + APP_CONFIG.wsPort);
    useRealtimeStore.getState().setLastEvent(`ws_init:connecting_to_${APP_CONFIG.wsHost}:${APP_CONFIG.wsPort}`);

    connection.bind('state_change', (data: unknown) => {
      const states = data as {previous?: string; current?: string};
      const current = states?.current ?? 'unknown';
      console.log('[WS] state_change: ' + (states?.previous ?? '?') + ' -> ' + current);
      useRealtimeStore.getState().setLastEvent(`conn:${current}`);
      if (current === 'connected') {
        useRealtimeStore.getState().setStatus('connected');
      } else if (current === 'disconnected' || current === 'failed') {
        useRealtimeStore.getState().setStatus('disconnected');
      } else if (current === 'unavailable') {
        useRealtimeStore.getState().setStatus('error');
      }
    });

    connection.bind('error', (err: unknown) => {
      let errStr = '';
      try {
        errStr = JSON.stringify(err);
      } catch {
        errStr = String(err);
      }

      const errObj =
        err && typeof err === 'object' ? (err as Record<string, unknown>) : {};
      const topType = String(errObj.type ?? 'unknown');
      const nestedError =
        errObj.error && typeof errObj.error === 'object'
          ? (errObj.error as Record<string, unknown>)
          : {};
      const nestedData =
        nestedError.data && typeof nestedError.data === 'object'
          ? (nestedError.data as Record<string, unknown>)
          : {};
      const code = String(nestedData.code ?? nestedError.code ?? '');
      const message = String(nestedData.message ?? nestedError.message ?? '');
      const summary = [topType, code, message].filter(Boolean).join(':');

      console.log('[WS] connection error: ' + errStr);
      useRealtimeStore.getState().setStatus('error');
      useRealtimeStore.getState().setLastEvent(
        `conn_error:${summary || 'unknown'}`,
      );
    });
  }

  private subscribeUserChannel(userId: number): void {
    if (!this.echo) {
      return;
    }

    const userChannelNames = [`internal-ops.user.${userId}`];

    for (const userChannelName of userChannelNames) {
      console.log('[WS] subscribing user channel:', userChannelName);
      const userChannel = this.echo.private(userChannelName);

      (
        userChannel as unknown as {
          subscribed?: (cb: () => void) => void;
        }
      ).subscribed?.(() => {
        console.log('[WS] user channel subscribed:', userChannelName);
        useRealtimeStore
          .getState()
          .setLastEvent(`subscribed:${userChannelName}`);
      });

      // Log subscription success/error so Dashboard shows if auth is working
      (userChannel as unknown as {error?: (cb: (err: unknown) => void) => void})
        .error?.((err: unknown) => {
          const msg = err && typeof err === 'object' ? JSON.stringify(err) : String(err);
          useRealtimeStore.getState().setLastEvent(`sub_error:${userChannelName}:${msg.slice(0, 80)}`);
        });

      // Some backends broadcast new messages on the recipient's user channel.
      // Listen here as a fallback so messages are never missed.
      for (const eventName of MESSAGE_EVENTS) {
        userChannel.listen(eventName, (payload: unknown) => {
          try {
            useRealtimeStore
              .getState()
              .setLastEvent(`${userChannelName}:${eventName}`);
            const message = normalizeMessagePayload(payload);
            if (message) {
              this.emitIncomingMessage(
                message,
                `${userChannelName}:${eventName}`,
              );
            }
          } catch (err) {
            console.error(`[WS] Error handling ${userChannelName}:${eventName}:`, err);
          }
        });
      }

      for (const eventName of NOTIFICATION_EVENTS) {
        userChannel.listen(eventName, (payload: unknown) => {
          try {
            useRealtimeStore
              .getState()
              .setLastEvent(`${userChannelName}:${eventName}`);
            const notification = normalizeNotificationPayload(payload);
            if (notification) {
              this.callbacks?.onIncomingNotification(notification);
            }
          } catch (err) {
            console.error(`[WS] Error handling ${userChannelName}:${eventName}:`, err);
          }
        });
      }

      for (const eventName of UNREAD_EVENTS) {
        userChannel.listen(eventName, (payload: unknown) => {
          try {
            useRealtimeStore
              .getState()
              .setLastEvent(`${userChannelName}:${eventName}`);
            this.callbacks?.onUnreadUpdated(normalizeUnreadPayload(payload));
          } catch (err) {
            console.error(`[WS] Error handling ${userChannelName}:${eventName}:`, err);
          }
        });
      }
    }
  }

  private subscribeConversationChannel(conversationId: number): void {
    if (!this.echo) {
      return;
    }

    const channelName = `internal-ops.conversation.${conversationId}`;
    console.log('[WS] subscribing conversation channel:', channelName);
    const channel = this.echo.private(channelName);

    (
      channel as unknown as {
        subscribed?: (cb: () => void) => void;
      }
    ).subscribed?.(() => {
      console.log('[WS] conversation channel subscribed:', channelName);
      useRealtimeStore.getState().setLastEvent(`subscribed:${channelName}`);
    });

    // Log subscription success/error so Dashboard shows if auth is working
    (channel as unknown as {error?: (cb: (err: unknown) => void) => void})
      .error?.((err: unknown) => {
        const msg = err && typeof err === 'object' ? JSON.stringify(err) : String(err);
        useRealtimeStore.getState().setLastEvent(`sub_error:${channelName}:${msg.slice(0, 80)}`);
      });

    for (const eventName of MESSAGE_EVENTS) {
      channel.listen(eventName, (payload: unknown) => {
        try {
          useRealtimeStore
            .getState()
            .setLastEvent(`conv.${conversationId}:${eventName}`);
          const message = normalizeMessagePayload(payload);
          if (message) {
            this.emitIncomingMessage(
              message,
              `conversation.${conversationId}:${eventName}`,
            );
          }
        } catch (err) {
          console.error(`[WS] Error handling conversation ${conversationId}:${eventName}:`, err);
        }
      });
    }
  }
}

export const websocketService = new WebsocketService();
