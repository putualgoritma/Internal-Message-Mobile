import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {RouteProp} from '@react-navigation/native';

import {chatApi} from '../api/chatApi';
import {ChatBubble} from '../components/ChatBubble';
import {EmptyState} from '../components/EmptyState';
import {ErrorBanner} from '../components/ErrorBanner';
import {colors} from '../theme/colors';
import type {RootStackParamList} from '../navigation/types';
import {useAuthStore} from '../store/authStore';
import {useUnreadStore} from '../store/unreadStore';
import type {ChatMessage} from '../types/models';

type ChatRoomRouteProp = RouteProp<RootStackParamList, 'ChatRoom'>;

interface ChatRoomScreenProps {
  route: ChatRoomRouteProp;
}

function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function hasMessage(messages: ChatMessage[], messageId: number): boolean {
  return messages.some(item => item.id === messageId);
}

export function ChatRoomScreen({route}: ChatRoomScreenProps): React.JSX.Element {
  const conversationId = useMemo(() => {
    const raw = Number(route.params.conversationId);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [route.params.conversationId]);
  const recipientUserId = useMemo(() => {
    const raw = Number(route.params.recipientUserId);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [route.params.recipientUserId]);

  const initialConversationIdRef = useRef<number | null>(conversationId);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(
    conversationId,
  );

  const currentUserId = useAuthStore(state => state.user?.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let isMounted = true;
    const targetConversationId = initialConversationIdRef.current;

    const loadConversation = async () => {
      if (!targetConversationId) {
        if (isMounted) {
          setLoadingMessages(false);
        }
        return;
      }

      if (isMounted) {
        setLoadingMessages(true);
        setError(null);
      }

      try {
        const fetchedMessages = await chatApi.getMessages(targetConversationId);
        if (isMounted) {
          setMessages(sortMessages(fetchedMessages));
        }

        await chatApi.markConversationRead(targetConversationId);

        const unreadStore = useUnreadStore.getState();
        const previousUnread =
          unreadStore.unreadByConversation[targetConversationId] ?? 0;
        unreadStore.setConversationUnread(targetConversationId, 0);
        unreadStore.setTotalChatUnread(
          Math.max(0, unreadStore.totalChatUnread - previousUnread),
        );
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load messages.',
          );
        }
      } finally {
        if (isMounted) {
          setLoadingMessages(false);
        }
      }
    };

    loadConversation().catch(() => {
      // Errors are captured in local state above.
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const onSubmit = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    if (!activeConversationId && !recipientUserId) {
      setError('Recipient is missing. Please start chat from New Chat.');
      return;
    }

    try {
      setSendingMessage(true);
      setError(null);

      const newMessage = await chatApi.sendMessage(
        activeConversationId
          ? {
              conversation_id: activeConversationId,
              content: trimmed,
              type: 'text',
            }
          : {
              recipient_user_id: recipientUserId ?? undefined,
              content: trimmed,
              type: 'text',
            },
      );

      if (!activeConversationId && newMessage.conversation_id) {
        setActiveConversationId(newMessage.conversation_id);
      }

      setMessages(previous => {
        if (hasMessage(previous, newMessage.id)) {
          return previous;
        }

        return sortMessages([...previous, newMessage]);
      });
      setDraft('');
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : 'Failed to send message.',
      );
    } finally {
      setSendingMessage(false);
    }
  }, [activeConversationId, draft, recipientUserId]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.page}>
      {error ? <ErrorBanner message={error} /> : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={messages}
        keyExtractor={item => String(item.id)}
        renderItem={({item}) => (
          <ChatBubble
            isOwn={Boolean(currentUserId && item.sender_id === currentUserId)}
            message={item}
          />
        )}
        ListEmptyComponent={
          loadingMessages ? null : (
            <EmptyState
              subtitle="New messages will appear here in real-time."
              title="No messages yet"
            />
          )
        }
      />

      <View style={styles.inputRow}>
        <TextInput
          editable={!sendingMessage}
          multiline
          onChangeText={setDraft}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={draft}
        />
        <Pressable
          disabled={sendingMessage}
          onPress={() => {
            onSubmit().catch(() => {
              // Errors are captured in local state.
            });
          }}
          style={[styles.sendButton, sendingMessage ? styles.sendDisabled : null]}>
          <Text style={styles.sendLabel}>{sendingMessage ? '...' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.background,
    flex: 1,
    paddingTop: 8,
  },
  list: {
    padding: 12,
    paddingBottom: 20,
  },
  inputRow: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  input: {
    backgroundColor: '#F1F4F8',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.textPrimary,
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 56,
    paddingHorizontal: 12,
  },
  sendDisabled: {
    opacity: 0.7,
  },
  sendLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
