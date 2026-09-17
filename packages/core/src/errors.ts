export class CoreError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'CoreError';
    this.code = code;
    this.status = status;
  }
}

export const invalid = (message: string) => new CoreError('INVALID_INPUT', message, 400);
export const unavailable = (message: string) => new CoreError('UNAVAILABLE', message, 409);
export const notFound = (message: string) => new CoreError('NOT_FOUND', message, 404);
