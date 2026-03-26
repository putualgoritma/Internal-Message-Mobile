import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import type {Conversation} from '../types/models';
import {colors} from '../theme/colors';
import {BadgePill} from './BadgePill';

interface ConversationItemProps {
  item: Conversation;
  currentUserId?: number | null;
  titleOverride?: string;
  unreadCount: number;
  onPress: () => void;
}

function isGenericConversationTitle(value: string): boolean {
  return /^conversation(?:\s|#|$)/i.test(value.trim());
}

function pushName(values: string[], value: unknown): void {
  if (typeof value !== 'string') {
    return;
  }

  const trimmed = value.trim();
  if (!trimmed || isGenericConversationTitle(trimmed)) {
    return;
  }

  if (!values.includes(trimmed)) {
    values.push(trimmed);
  }
}

function extractCandidateNames(item: Conversation): string[] {
  const names: string[] = [];
  const asRecord = item as unknown as Record<string, unknown>;

  // Handle backend payload variants that do not send participants[].
  pushName(names, asRecord.user_name);
  pushName(names, asRecord.contact_name);
  pushName(names, asRecord.recipient_name);
  pushName(names, asRecord.counterpart_name);
  pushName(names, asRecord.assigned_user_name);

  const participant = asRecord.participant as Record<string, unknown> | undefined;
  pushName(names, participant?.name);

  const user = asRecord.user as Record<string, unknown> | undefined;
  pushName(names, user?.name);

  const recipient = asRecord.recipient as Record<string, unknown> | undefined;
  pushName(names, recipient?.name);

  const lastSender = item.last_message?.sender?.name;
  pushName(names, lastSender);

  return names;
}

export function getConversationTitle(
  item: Conversation,
  currentUserId?: number | null,
): string {
  const fallbackNames = extractCandidateNames(item);

  if (item.participants && item.participants.length > 0) {
    const others =
      currentUserId == null
        ? item.participants
        : item.participants.filter(participant => participant.id !== currentUserId);

    if (others.length > 0) {
      return others.map(participant => participant.name).join(', ');
    }

    return item.participants.map(participant => participant.name).join(', ');
  }

  if (fallbackNames.length > 0) {
    return fallbackNames.join(', ');
  }

  if (item.title) {
    if (isGenericConversationTitle(item.title)) {
      return `Chat #${item.id}`;
    }

    return item.title;
  }

  return `Conversation #${item.id}`;
}

export function ConversationItem({
  item,
  currentUserId,
  titleOverride,
  unreadCount,
  onPress,
}: ConversationItemProps): React.JSX.Element {
  const preview = item.last_message?.content ?? 'No messages yet';
  const title =
    typeof titleOverride === 'string' && titleOverride.trim()
      ? titleOverride.trim()
      : getConversationTitle(item, currentUserId);

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.content}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.preview}>
          {preview}
        </Text>
      </View>
      <BadgePill value={unreadCount} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 14,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  preview: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
