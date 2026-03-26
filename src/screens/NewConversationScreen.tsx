import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';

import {chatApi} from '../api/chatApi';
import {EmptyState} from '../components/EmptyState';
import {ErrorBanner} from '../components/ErrorBanner';
import type {RootStackParamList} from '../navigation/types';
import {colors} from '../theme/colors';
import type {User} from '../types/models';

type NewConversationNavigation = StackNavigationProp<RootStackParamList>;

export function NewConversationScreen(): React.JSX.Element {
  const navigation = useNavigation<NewConversationNavigation>();

  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedQuery = useMemo(() => query.trim(), [query]);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await chatApi.getContacts(normalizedQuery);
      setContacts(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load contacts.',
      );
    } finally {
      setLoading(false);
    }
  }, [normalizedQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadContacts().catch(() => {
        // Error is already captured in state.
      });
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [loadContacts]);

  return (
    <View style={styles.container}>
      <TextInput
        autoCapitalize="none"
        onChangeText={setQuery}
        placeholder="Search name or email"
        placeholderTextColor={colors.textSecondary}
        style={styles.search}
        value={query}
      />

      {error ? <ErrorBanner message={error} /> : null}

      {loading && contacts.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.brand} size="small" />
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={contacts}
        keyExtractor={item => String(item.id)}
        refreshControl={
          <RefreshControl onRefresh={loadContacts} refreshing={loading} />
        }
        renderItem={({item}) => (
          <Pressable
            onPress={() =>
              navigation.replace('ChatRoom', {
                recipientUserId: item.id,
                title: item.name,
              })
            }
            style={styles.item}>
            <Text numberOfLines={1} style={styles.name}>
              {item.name}
            </Text>
            <Text numberOfLines={1} style={styles.email}>
              {item.email}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              subtitle="Try another keyword or refresh."
              title="No contacts found"
            />
          )
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
  search: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.textPrimary,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  list: {
    paddingBottom: 20,
  },
  loaderWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  item: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  email: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
