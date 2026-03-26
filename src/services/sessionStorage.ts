import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_TOKEN_KEY = '@ptab_internal:session_token';
const SESSION_USER_KEY = '@ptab_internal:session_user';

export async function getSessionToken(): Promise<string | null> {
  return AsyncStorage.getItem(SESSION_TOKEN_KEY);
}

export async function setSessionToken(token: string): Promise<void> {
  await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
}

export async function getSessionUser<T>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(SESSION_USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setSessionUser<T>(user: T): Promise<void> {
  await AsyncStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
}

export async function clearSessionToken(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
}

export async function clearSessionUser(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_USER_KEY);
}
