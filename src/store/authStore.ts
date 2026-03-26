import {create} from 'zustand';

import {authApi} from '../api/authApi';
import {setAuthToken} from '../api/client';
import {
  clearSessionUser,
  clearSessionToken,
  getSessionToken,
  getSessionUser,
  setSessionToken,
  setSessionUser,
} from '../services/sessionStorage';
import type {User} from '../types/models';
import {toErrorMessage} from '../utils/api';
import {getPushSubscriptionId, setPushIdentity} from '../services/pushService';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBootstrapping: boolean;
  error: string | null;
  bootstrapSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  isBootstrapping: true,
  error: null,

  bootstrapSession: async () => {
    set({isBootstrapping: true, error: null});

    try {
      const token = await getSessionToken();
      const user = await getSessionUser<User>();
      if (!token || !user) {
        await clearSessionToken();
        await clearSessionUser();
        set({
          isAuthenticated: false,
          isBootstrapping: false,
          token: null,
          user: null,
        });
        return;
      }

      setAuthToken(token);
      set({
        user,
        token,
        isAuthenticated: true,
        isBootstrapping: false,
      });
    } catch {
      await clearSessionToken();
      await clearSessionUser();
      setAuthToken(null);
      setPushIdentity(null);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isBootstrapping: false,
      });
    }
  },

  login: async (email: string, password: string) => {
    set({isLoading: true, error: null});

    try {
      const pushId = await getPushSubscriptionId();
      const result = await authApi.login(email.trim(), password, pushId);
      const token = result.token;
      const user = result.user;

      await setSessionToken(token);
      await setSessionUser(user);
      setAuthToken(token);
      setPushIdentity(String(user.id));

      set({
        user,
        token,
        isAuthenticated: true,
      });
    } catch (error) {
      set({error: toErrorMessage(error)});
      throw error;
    } finally {
      set({isLoading: false});
    }
  },

  logout: async () => {
    const token = get().token;

    try {
      if (token) {
        await authApi.logout();
      }
    } catch {
      // Ignore logout API errors so local session can still be cleared.
    } finally {
      await clearSessionToken();
      await clearSessionUser();
      setAuthToken(null);
      setPushIdentity(null);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        error: null,
      });
    }
  },
}));
