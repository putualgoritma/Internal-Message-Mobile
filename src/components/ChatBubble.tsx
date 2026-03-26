import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import type {ChatMessage} from '../types/models';
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
  const isSystem = message.type === 'system' || message.type === 'action';

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{message.content}</Text>
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
});
