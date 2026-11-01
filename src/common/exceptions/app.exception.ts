import { HttpException } from '@nestjs/common';
import { ErrorCode, ErrorCodes } from '../constants/error-codes';

/**
 * Application exception carrying a deterministic error code (other.md §7)
 * rendered through the standard error envelope (main.md §7.2).
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: Record<string, any>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, any>) {
    const def = ErrorCodes[code];
    super(
      {
        success: false,
        error: {
          code,
          message: message || def.message,
          ...(details ? { details } : {}),
        },
      },
      def.status,
    );
    this.code = code;
    this.details = details;
  }
}
