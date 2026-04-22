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
import type {FlatList as FlatListType} from 'react-native';

import {RouteProp, useFocusEffect} from '@react-navigation/native';
import {useIsFocused} from '@react-navigation/native';

import {chatApi} from '../api/chatApi';
import {ChatBubble} from '../components/ChatBubble';
import {EmptyState} from '../components/EmptyState';
import {ErrorBanner} from '../components/ErrorBanner';
import {colors} from '../theme/colors';
import type {RootStackParamList} from '../navigation/types';
import {useAuthStore} from '../store/authStore';
import {useChatStore} from '../store/chatStore';
import type {ChatMessage} from '../types/models';

interface DateSeparator {
  kind: '__date_separator__';
  id: string;
  label: string;
}

type ListItem = ChatMessage | DateSeparator;

function parseDate(dateStr: string): Date {
  // Handle "YYYY-MM-DD HH:MM:SS" (no T, no timezone) from backend
  const normalized = dateStr.replace(' ', 'T');
  return new Date(normalized);
}

function getDateLabel(dateStr: string): string {
  const date = parseDate(dateStr);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) {
    return 'Today';
  }
  if (sameDay(date, yesterday)) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, {day: 'numeric', month: 'long', year: 'numeric'});
}

function getDayKey(dateStr: string): string {
  const date = parseDate(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function injectDateSeparators(messages: ChatMessage[]): ListItem[] {
  const result: ListItem[] = [];
  let lastDayKey = '';
  for (const msg of messages) {
    const dayKey = getDayKey(msg.created_at);
    if (dayKey !== lastDayKey) {
      lastDayKey = dayKey;
      result.push({kind: '__date_separator__', id: `sep-${dayKey}`, label: getDateLabel(msg.created_at)});
    }
    result.push(msg);
  }
  return result;
}

type ChatRoomRouteProp = RouteProp<RootStackParamList, 'ChatRoom'>;

interface ChatRoomScreenProps {
  route: ChatRoomRouteProp;
}

function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();

    // If both timestamps are valid, sort by time
    if (Number.isFinite(timeA) && Number.isFinite(timeB)) {
      return timeA - timeB;
    }

    // If only A is valid, A comes first
    if (Number.isFinite(timeA)) {
      return -1;
    }

    // If only B is valid, B comes first
    if (Number.isFinite(timeB)) {
      return 1;
    }

    // If neither is valid, maintain relative order by ID
    return Number(a.id) - Number(b.id);
  });
}

export function ChatRoomScreen({route}: ChatRoomScreenProps): React.JSX.Element {
  const isFocused = useIsFocused();
  const conversationId = useMemo(() => {
    const raw = Number(route.params.conversationId);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [route.params.conversationId]);
  const recipientUserId = useMemo(() => {
    const raw = Number(route.params.recipientUserId);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [route.params.recipientUserId]);

  const [activeConversationId, setActiveConversationId] = useState<number | null>(
    conversationId,
  );

  const currentUserId = useAuthStore(state => state.user?.id);
  const fetchMessages = useChatStore(state => state.fetchMessages);
  const markConversationRead = useChatStore(state => state.markConversationRead);
  const loadingMessages = useChatStore(state => state.loadingMessages);
  const messagesByConversation = useChatStore(state => state.messagesByConversation);

  // Derive sorted messages from the store so realtime updates appear automatically
  const messages = useMemo(
    () => sortMessages(messagesByConversation[activeConversationId ?? 0] ?? []),
    [messagesByConversation, activeConversationId],
  );

  const listItems = useMemo(() => injectDateSeparators(messages), [messages]);

  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const flatListRef = useRef<FlatListType<ListItem>>(null);
  const lastAutoReadMessageIdRef = useRef<number | null>(null);

  // Scroll to bottom whenever message list grows
  const messageCount = messages.length;
  useEffect(() => {
    if (messageCount > 0) {
      flatListRef.current?.scrollToEnd({animated: true});
    }
  }, [messageCount]);

  // Load messages from store on mount
  useEffect(() => {
    if (!conversationId) {
      return;
    }

    fetchMessages(conversationId).catch(() => {});
    markConversationRead(conversationId).catch(() => {});
  }, [conversationId, fetchMessages, markConversationRead]);

  // Auto-mark-read when screen gains focus (clears badge if new messages arrived while away)
  useFocusEffect(
    useCallback(() => {
      if (!activeConversationId) {
        return () => {};
      }

      markConversationRead(activeConversationId).catch(() => {});

    }, [activeConversationId, markConversationRead]),
  );

  // When a new remote message arrives while viewing this room, clear unread immediately.
  useEffect(() => {
    console.log('[ChatRoom] Auto-read effect: isFocused=', isFocused, 'activeConversationId=', activeConversationId, 'messagesLength=', messages.length);
    
    if (!isFocused || !activeConversationId || messages.length === 0) {
      return;
    }

    try {
      const latest = messages[messages.length - 1];
      console.log('[ChatRoom] Latest message:', latest?.id, 'sender_id:', latest?.sender_id, 'currentUserId:', currentUserId);
      
      if (!latest || latest.sender_id == null || latest.sender_id === currentUserId) {
        return;
      }

      if (lastAutoReadMessageIdRef.current === latest.id) {
        console.log('[ChatRoom] Already marked as read:', latest.id);
        return;
      }

      console.log('[ChatRoom] Marking conversation read for message:', latest.id);
      lastAutoReadMessageIdRef.current = latest.id;
      markConversationRead(activeConversationId).catch((err) => {
        console.error('[ChatRoom] Error marking read:', err);
      });
    } catch (err) {
      console.error('[ChatRoom] Error in auto-read effect:', err);
    }
  }, [
    activeConversationId,
    currentUserId,
    isFocused,
    markConversationRead,
    messages,
  ]);

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
        fetchMessages(newMessage.conversation_id).catch(() => {});
      }

      // Add to store so the message appears via the store subscription
      useChatStore.getState().upsertIncomingMessage(newMessage);
      setDraft('');
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : 'Failed to send message.',
      );
    } finally {
      setSendingMessage(false);
    }
  }, [activeConversationId, draft, fetchMessages, recipientUserId]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.page}>
      {error ? <ErrorBanner message={error} /> : null}

      <FlatList
        ref={flatListRef}
        contentContainerStyle={styles.list}
        data={listItems}
        keyExtractor={item =>
          (item as DateSeparator).kind === '__date_separator__'
            ? (item as DateSeparator).id
            : String((item as ChatMessage).id)
        }
        renderItem={({item}) => {
          if ((item as DateSeparator).kind === '__date_separator__') {
            return (
              <View style={styles.dateSeparatorWrap}>
                <View style={styles.dateSeparatorLine} />
                <Text style={styles.dateSeparatorLabel}>{(item as DateSeparator).label}</Text>
                <View style={styles.dateSeparatorLine} />
              </View>
            );
          }
          const msg = item as ChatMessage;
          return (
            <ChatBubble
              isOwn={Boolean(currentUserId && msg.sender_id === currentUserId)}
              message={msg}
            />
          );
        }}
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
  dateSeparatorWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  dateSeparatorLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  dateSeparatorLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    flexShrink: 0,
    marginHorizontal: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.background,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
