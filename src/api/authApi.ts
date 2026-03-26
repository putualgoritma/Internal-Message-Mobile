import axios from 'axios';
import {apiClient} from './client';
import type {User} from '../types/models';
import {unwrapApiPayload} from '../utils/api';

interface LoginResponse {
  token: string;
  user: User;
}

interface RawLoginResponse {
  success?: boolean;
  message?: string;
  token?: string;
  user?: User;
  data?: User | {token?: string; user?: User};
}

function normalizeLoginResponse(payload: unknown): LoginResponse {
  const raw = payload as RawLoginResponse;
  if (raw && raw.success === false) {
    throw new Error(raw.message ?? 'Login failed');
  }

  if (raw?.token && raw.user) {
    return {token: raw.token, user: raw.user};
  }

  if (raw?.token && raw.data && !('token' in raw.data)) {
    return {token: raw.token, user: raw.data as User};
  }

  if (raw?.success && raw.data && 'token' in raw.data) {
    const data = raw.data as {token?: string; user?: User};
    if (data.token && data.user) {
      return {token: data.token, user: data.user};
    }
  }

  const normalized = unwrapApiPayload<unknown>(payload) as
    | LoginResponse
    | undefined;
  if (normalized?.token && normalized.user) {
    return normalized;
  }

  throw new Error('Unexpected login response');
}

function shouldRetryWithoutPush(error: unknown): boolean {
  let message = '';

  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {message?: string}
      | string
      | undefined;

    message =
      typeof data === 'string'
        ? data
        : typeof data?.message === 'string'
        ? data.message
        : error.message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  if (!message) {
    return false;
  }

  const lowered = message.toLowerCase();
  return (
    lowered.includes('unexpected token') ||
    lowered.includes('no stack') ||
    lowered.includes('syntax error')
  );
}

export const authApi = {
  async login(
    email: string,
    password: string,
    pushId?: string | null,
  ): Promise<LoginResponse> {
    if (pushId) {
      try {
        const response = await apiClient.post('/open/admin/login', {
          email,
          password,
          _id_onesignal: pushId,
        });
        return normalizeLoginResponse(response.data);
      } catch (error) {
        if (!shouldRetryWithoutPush(error)) {
          throw error;
        }
      }
    }

    const fallbackResponse = await apiClient.post('/open/admin/login-js', {
      email,
      password,
    });
    return normalizeLoginResponse(fallbackResponse.data);
  },

  async me(): Promise<User> {
    const response = await apiClient.get('/auth/me');
    return unwrapApiPayload<User>(response.data);
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
};
