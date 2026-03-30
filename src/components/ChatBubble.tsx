import React, {useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

import type {ChatMessage} from '../types/models';
import {chatApi} from '../api/chatApi';
import {colors} from '../theme/colors';

interface ChatBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
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

  const isSystem = message.type === 'system';
  const isAction = message.type === 'action';

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  if (isAction) {
    const metadata = message.metadata as {actions?: Array<{label: string; endpoint: string; method?: string}>} | undefined;
    const actions = metadata?.actions ?? [];

    const handleActionPress = async (endpoint: string, method?: string) => {
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
          <Text style={styles.actionContent}>{message.content}</Text>
          {actionError && <Text style={styles.actionErrorText}>{actionError}</Text>}
          <View style={styles.actionsContainer}>
            {actions.map((action, index) => (
              <Pressable
                key={index}
                disabled={actionLoading !== null}
                onPress={() => handleActionPress(action.endpoint, action.method)}
                style={[
                  styles.actionButton,
                  actionLoading === action.endpoint && styles.actionButtonLoading,
                ]}>
                {actionLoading === action.endpoint ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : (
                  <Text style={styles.actionButtonLabel}>{action.label}</Text>
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
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
  },
  actionButtonLoading: {
    opacity: 0.7,
  },
  actionButtonLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionTime: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
});
