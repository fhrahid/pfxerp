import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Standard error envelope (main.md §7.2) + Prisma exception mapping.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as any;
      if (body && typeof body === 'object' && body.error && body.error.code) {
        // Already an AppException-shaped envelope
        return response.status(status).json(body);
      }
      return response.status(status).json({
        success: false,
        error: {
          code: body?.code || `HTTP_${status}`,
          message: body?.message || body?.error || exception.message,
        },
      });
    }

    // Prisma known errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return response.status(HttpStatus.CONFLICT).json({
          success: false,
          error: { code: 'CONFLICT', message: 'Unique constraint violation.', details: { target: exception.meta?.target } },
        });
      }
      if (exception.code === 'P2025') {
        return response.status(HttpStatus.NOT_FOUND).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Resource not found.' },
        });
      }
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' },
    });
  }
}
