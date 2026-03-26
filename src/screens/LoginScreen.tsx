import React, {useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {colors} from '../theme/colors';
import {useAuthStore} from '../store/authStore';

export function LoginScreen(): React.JSX.Element {
  const login = useAuthStore(state => state.login);
  const isLoading = useAuthStore(state => state.isLoading);
  const authError = useAuthStore(state => state.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const onLogin = async (): Promise<void> => {
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError('Email and password are required.');
      return;
    }

    try {
      await login(email, password);
    } catch {
      // Error is already handled in auth store.
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>PTAB Internal Message</Text>
        <Text style={styles.subtitle}>Sign in with your internal account.</Text>

        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email / NIP"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={email}
        />

        <TextInput
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        {localError ? <Text style={styles.error}>{localError}</Text> : null}
        {authError ? <Text style={styles.error}>{authError}</Text> : null}

        <Pressable
          disabled={isLoading}
          onPress={() => {
            onLogin().catch(() => {
              // Store already captures error state.
            });
          }}
          style={[styles.button, isLoading ? styles.buttonDisabled : null]}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonLabel}>Login</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 18,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#F1F4F8',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.textPrimary,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 6,
  },
});
