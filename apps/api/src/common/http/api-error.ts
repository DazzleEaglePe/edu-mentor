import { HttpException } from '@nestjs/common';

export type ApiErrorDetails = Readonly<Record<string, unknown>>;

export class ApiError extends HttpException {
  readonly code: string;
  readonly details: ApiErrorDetails | undefined;
  readonly safeMessage: string;

  constructor(statusCode: number, code: string, safeMessage: string, details?: ApiErrorDetails) {
    super(
      { code, message: safeMessage, ...(details === undefined ? {} : { details }) },
      statusCode,
    );
    this.code = code;
    this.safeMessage = safeMessage;
    this.details = details;
  }
}
