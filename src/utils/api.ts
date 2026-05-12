import axios from 'axios';

import type {ApiErrorShape} from '../types/models';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export function unwrapApiPayload<T>(payload: unknown): T {
  if (!payload || typeof payload !== 'object') {
    return payload as T;
  }

  const maybeEnvelope = payload as Partial<ApiEnvelope<T>>;
  if (typeof maybeEnvelope.success === 'boolean') {
    if (!maybeEnvelope.success) {
      throw new Error(maybeEnvelope.message ?? 'Request failed');
    }

    return maybeEnvelope.data as T;
  }

  return payload as T;
}

export function toErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | ApiErrorShape
      | {error?: string; errors?: Record<string, string[] | string>}
      | string
      | undefined;

    if (typeof data === 'string' && data.trim()) {
      return data;
    }

    if (data && typeof data === 'object') {
      const message =
        (data as {message?: string}).message ??
        (data as {error?: string}).error;

      if (typeof message === 'string' && message.trim()) {
        return message;
      }

      const fieldErrors = (data as {errors?: Record<string, string[] | string>}).errors;
      if (fieldErrors && typeof fieldErrors === 'object') {
        const firstValue = Object.values(fieldErrors)[0];
        if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
          return firstValue[0];
        }
        if (typeof firstValue === 'string') {
          return firstValue;
        }
      }
    }

    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Please try again.';
    }

    if (!error.response) {
      return 'Cannot reach server. Check internet connection and API URL.';
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected error';
}
