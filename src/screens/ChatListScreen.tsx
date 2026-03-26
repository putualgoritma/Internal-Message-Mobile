import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';

import {ConversationItem, getConversationTitle} from '../components/ConversationItem';
import {EmptyState} from '../components/EmptyState';
import {ErrorBanner} from '../components/ErrorBanner';
import {colors} from '../theme/colors';
import {chatApi} from '../api/chatApi';
import {useAuthStore} from '../store/authStore';
import {useChatStore} from '../store/chatStore';
import {useUnreadStore} from '../store/unreadStore';
import type {RootStackParamList} from '../navigation/types';
import type {ChatMessage} from '../types/models';

type ChatListNavigation = StackNavigationProp<RootStackParamList>;

export function ChatListScreen(): React.JSX.Element {
  const navigation = useNavigation<ChatListNavigation>();
  const currentUserId = useAuthStore(state => state.user?.id ?? null);
  const conversations = useChatStore(state => state.conversations);
  const fetchConversations = useChatStore(state => state.fetchConversations);
  const loadingConversations = useChatStore(state => state.loadingConversations);
  const error = useChatStore(state => state.error);
  const unreadByConversation = useUnreadStore(state => state.unreadByConversation);
  const [derivedTitles, setDerivedTitles] = useState<Record<number, string>>({});

  const refreshConversations = useCallback(() => {
    fetchConversations().catch(() => {
      // Store already captures error state.
    });
  }, [fetchConversations]);

  useFocusEffect(
    useCallback(() => {
      refreshConversations();
    }, [refreshConversations]),
  );

  const conversationIdsKey = useMemo(
    () => conversations.map(item => item.id).join(','),
    [conversations],
  );

  useEffect(() => {
    let cancelled = false;

    function deriveNameFromMessages(messages: ChatMessage[]): string | null {
      const candidates = messages
        .map(item => ({id: item.sender_id, name: item.sender?.name?.trim() ?? ''}))
        .filter(item => item.name.length > 0);

      if (candidates.length === 0) {
        return null;
      }

      const fromOthers = candidates.find(
        item => currentUserId == null || item.id !== currentUserId,
      );
      if (fromOthers) {
        return fromOthers.name;
      }

      return candidates[0].name;
    }

    async function loadDerivedTitles(): Promise<void> {
      const nextTitles: Record<number, string> = {};

      await Promise.all(
        conversations.map(async item => {
          const baseTitle = getConversationTitle(item, currentUserId);
          if (!/^chat\s*#/i.test(baseTitle) && !/^conversation(?:\s|#|$)/i.test(baseTitle)) {
            return;
          }

          try {
            const messages = await chatApi.getMessages(item.id);
            const derivedName = deriveNameFromMessages(messages);
            if (derivedName) {
              nextTitles[item.id] = derivedName;
            }
          } catch {
            // Ignore per-item failure; existing label fallback remains.
          }
        }),
      );

      if (!cancelled) {
        setDerivedTitles(nextTitles);
      }
    }

    loadDerivedTitles().catch(() => {
      if (!cancelled) {
        setDerivedTitles({});
      }
    });

    return () => {
      cancelled = true;
    };
  }, [conversationIdsKey, conversations, currentUserId]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Chats</Text>
        <Pressable
          onPress={() => navigation.navigate('NewConversation')}
          style={styles.newChatButton}>
          <Text style={styles.newChatLabel}>+ New Chat</Text>
        </Pressable>
      </View>
      {error ? <ErrorBanner message={error} /> : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={conversations}
        keyExtractor={item => String(item.id)}
        refreshControl={
          <RefreshControl
            onRefresh={refreshConversations}
            refreshing={loadingConversations}
          />
        }
        renderItem={({item}) => (
          <ConversationItem
            currentUserId={currentUserId}
            item={item}
            titleOverride={derivedTitles[item.id]}
            onPress={() =>
              navigation.navigate('ChatRoom', {
                conversationId: item.id,
                title: derivedTitles[item.id] ?? getConversationTitle(item, currentUserId),
              })
            }
            unreadCount={unreadByConversation[item.id] ?? 0}
          />
        )}
          ListEmptyComponent={
            <EmptyState
              actionLabel="Refresh"
              onActionPress={refreshConversations}
              subtitle="No conversations are assigned to this account yet. Ask backend/admin to assign one, then pull to refresh."
              title="No conversations yet"
            />
          }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    padding: 16,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heading: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  newChatButton: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  newChatLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    paddingBottom: 24,
  },
});
