export class HttpError extends Error {
  status: number;

  code: string;

  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const unauthorizedError = (message = 'Unauthorized'): HttpError =>
  new HttpError(401, 'UNAUTHORIZED', message);

export const badRequestError = (message: string, details?: unknown): HttpError =>
  new HttpError(400, 'BAD_REQUEST', message, details);

export const notFoundError = (message: string): HttpError =>
  new HttpError(404, 'NOT_FOUND', message);
