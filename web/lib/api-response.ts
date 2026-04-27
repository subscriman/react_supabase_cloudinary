import type { NextApiResponse } from 'next';
import type { ApiErrorCode } from './api-contract';

type ErrorBody = {
  error: string;
  errorCode: ApiErrorCode;
  details?: unknown;
};

export function sendApiError(
  res: NextApiResponse,
  status: number,
  errorCode: ApiErrorCode,
  message: string,
  details?: unknown,
) {
  const body: ErrorBody = {
    error: message,
    errorCode,
  };
  if (details !== undefined) {
    body.details = details;
  }
  return res.status(status).json(body);
}

export function sendApiSuccess<T>(res: NextApiResponse, status: number, data: T) {
  return res.status(status).json({ data });
}

export function getApiErrorMessage(input: unknown, fallback: string): string {
  if (typeof input === 'string' && input.trim().length > 0) return input;
  if (input && typeof input === 'object') {
    const maybe = input as { message?: unknown };
    if (typeof maybe.message === 'string' && maybe.message.trim().length > 0) {
      return maybe.message;
    }
  }
  return fallback;
}
