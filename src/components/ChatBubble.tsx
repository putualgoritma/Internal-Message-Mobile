import React, {useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

import type {ChatMessage} from '../types/models';
import {chatApi} from '../api/chatApi';
import {colors} from '../theme/colors';

interface ChatBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

interface ActionButtonData {
  label: string;
  endpoint: string;
  method?: string;
}

function isRejectAction(action: ActionButtonData): boolean {
  const text = `${action.label} ${action.endpoint}`.toLowerCase();
  return /reject|decline|deny|disapprove|cancel/.test(text);
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

export function ChatBubble({message, isOwn}: ChatBubbleProps): React.JSX.Element {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizedType = String(message.type ?? 'text').trim().toLowerCase();
  const isSystem = normalizedType === 'system';
  const isAction =
    normalizedType === 'action' ||
    normalizedType === 'action_required' ||
    normalizedType === 'action-required';

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  if (isAction) {
    const metadata =
      message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
        ? (message.metadata as Record<string, unknown>)
        : undefined;
    const rawActions =
      (Array.isArray(metadata?.actions) ? metadata?.actions : undefined) ??
      (Array.isArray(metadata?.buttons) ? metadata?.buttons : undefined) ??
      (Array.isArray(metadata?.options) ? metadata?.options : undefined) ??
      [];
    const actions: ActionButtonData[] = rawActions
      .map((item): ActionButtonData | null => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const data = item as Record<string, unknown>;
        const label =
          typeof data.label === 'string'
            ? data.label.trim()
            : typeof data.title === 'string'
              ? data.title.trim()
              : typeof data.text === 'string'
                ? data.text.trim()
                : '';
        const endpoint =
          typeof data.endpoint === 'string'
            ? data.endpoint.trim()
            : typeof data.url === 'string'
              ? data.url.trim()
              : typeof data.path === 'string'
                ? data.path.trim()
                : '';
        const method =
          typeof data.method === 'string'
            ? data.method
            : typeof data.http_method === 'string'
              ? data.http_method
              : undefined;

        if (!label || !endpoint) {
          return null;
        }

        return {label, endpoint, method};
      })
      .filter((item): item is ActionButtonData => item !== null);
    const isTwoActions = actions.length === 2;

    const contentText = (() => {
      const raw = String(message.content ?? '').trim();
      if (raw && !/^there is no message\.?$/i.test(raw)) {
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

      return fromMetadata || 'Action required';
    })();

    const handleActionPress = async (endpoint: string, method?: string) => {
      console.log(
        `[Action] button tap method="${(method ?? 'POST').toUpperCase()}" endpoint="${endpoint}"`,
      );
      setActionLoading(endpoint);
      setActionError(null);
      try {
        await chatApi.executeAction(endpoint, method ?? 'POST');
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Action failed');
      } finally {
        setActionLoading(null);
      }
    };

    return (
      <View style={[styles.row, styles.rowOther]}>
        <View style={styles.actionBubble}>
          <Text style={styles.actionContent}>{contentText}</Text>
          {actionError && <Text style={styles.actionErrorText}>{actionError}</Text>}
          <View
            style={[
              styles.actionsContainer,
              isTwoActions && styles.actionsContainerTwo,
            ]}>
            {actions.map((action, index) => (
              <Pressable
                key={index}
                disabled={actionLoading !== null}
                onPress={() => handleActionPress(action.endpoint, action.method)}
                style={[
                  styles.actionButton,
                  isTwoActions && styles.actionButtonTwo,
                  isTwoActions && index === 0 && styles.actionButtonTwoLeft,
                  isTwoActions && index === 1 && styles.actionButtonTwoRight,
                  isRejectAction(action) && styles.actionButtonDanger,
                  actionLoading === action.endpoint && styles.actionButtonLoading,
                ]}>
                {actionLoading === action.endpoint ? (
                  <ActivityIndicator
                    size="small"
                    color={isRejectAction(action) ? colors.danger : '#FFFFFF'}
                  />
                ) : (
                  <Text
                    style={[
                      styles.actionButtonLabel,
                      isRejectAction(action) && styles.actionButtonLabelDanger,
                    ]}>
                    {action.label}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
          <Text style={styles.actionTime}>{formatTime(message.created_at)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text style={[styles.content, isOwn ? styles.contentOwn : styles.contentOther]}>
          {message.content}
        </Text>
        <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
          {formatTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 8,
    width: '100%',
  },
  rowOwn: {
    alignItems: 'flex-end',
  },
  rowOther: {
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 14,
    maxWidth: '85%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleOwn: {
    backgroundColor: colors.brand,
  },
  bubbleOther: {
    backgroundColor: '#E6EEF8',
  },
  content: {
    fontSize: 14,
  },
  contentOwn: {
    color: '#FFFFFF',
  },
  contentOther: {
    color: colors.textPrimary,
  },
  time: {
    fontSize: 11,
    marginTop: 4,
  },
  timeOwn: {
    color: '#E5EDF8',
  },
  timeOther: {
    color: colors.textSecondary,
  },
  systemWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  systemText: {
    backgroundColor: colors.muted,
    borderRadius: 10,
    color: colors.textSecondary,
    fontSize: 12,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    textAlign: 'center',
  },
  actionBubble: {
    backgroundColor: '#F0F4F9',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '85%',
    padding: 12,
  },
  actionContent: {
    color: colors.textPrimary,
    fontSize: 14,
    marginBottom: 12,
  },
  actionErrorText: {
    color: '#E53935',
    fontSize: 12,
    marginBottom: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  actionsContainerTwo: {
    flexWrap: 'nowrap',
    width: '100%',
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 8,
    justifyContent: 'center',
    marginBottom: 8,
    minHeight: 36,
    minWidth: 120,
    paddingHorizontal: 12,
  },
  actionButtonTwo: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  actionButtonTwoLeft: {
    marginRight: 4,
  },
  actionButtonTwoRight: {
    marginLeft: 4,
  },
  actionButtonDanger: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.danger,
    borderWidth: 1,
  },
  actionButtonLoading: {
    opacity: 0.7,
  },
  actionButtonLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonLabelDanger: {
    color: colors.danger,
  },
  actionTime: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
});
