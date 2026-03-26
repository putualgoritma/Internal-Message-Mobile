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
    const data = error.response?.data as ApiErrorShape | undefined;
    return data?.message ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected error';
}
