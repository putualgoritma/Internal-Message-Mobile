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

const LOGIN_REQUEST_TIMEOUT_MS = 12000;
const LOGIN_TIMEOUT_MESSAGE =
  'Login request timed out. Please check your internet connection and server URL.';

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

export const authApi = {
  async login(
    email: string,
    password: string,
    pushId?: string | null,
  ): Promise<LoginResponse> {
    const payload: Record<string, string> = {
      email,
      password,
    };

    if (pushId) {
      payload._id_onesignal = pushId;
    }

    try {
      const response = await apiClient.post('/open/admin/login', payload, {
        timeout: LOGIN_REQUEST_TIMEOUT_MS,
      });
      return normalizeLoginResponse(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        throw new Error(LOGIN_TIMEOUT_MESSAGE);
      }
      throw error;
    }
  },

  async me(): Promise<User> {
    const response = await apiClient.get('/auth/me');
    return unwrapApiPayload<User>(response.data);
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
};
