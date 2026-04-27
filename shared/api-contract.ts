export const API_ERROR_CODES = {
  methodNotAllowed: 'METHOD_NOT_ALLOWED',
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  invalidInput: 'INVALID_INPUT',
  notFound: 'NOT_FOUND',
  conflict: 'CONFLICT',
  badRequest: 'BAD_REQUEST',
  internalError: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export type ApiErrorBody = {
  error: string;
  errorCode: ApiErrorCode;
  details?: unknown;
};

export type ApiSuccessBody<T> = {
  data: T;
};
