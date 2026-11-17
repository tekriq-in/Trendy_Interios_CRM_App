import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Last line of defence for every HTTP error.
 *
 * - HttpExceptions keep their existing body (status, message, error), so
 *   current clients that read `message` / i18n keys are unaffected. We only
 *   add `requestId` so a user-reported error can be matched to a log line.
 * - Anything else is an unexpected failure: the stack is logged server-side
 *   and the client gets a generic 500 with no internals leaked.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    // Socket.IO / non-HTTP contexts are handled by their own adapters.
    if (host.getType() !== 'http') throw exception;

    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = req.id;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload =
        typeof body === 'string'
          ? { statusCode: status, message: body }
          : { ...(body as Record<string, unknown>) };

      if (status >= 500) {
        this.logger.error(`[${requestId}] ${req.method} ${req.url} -> ${status}`, exception.stack);
      }
      res.status(status).json({ ...payload, requestId });
      return;
    }

    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(
      `[${requestId}] Unhandled ${req.method} ${req.url}: ${error.message}`,
      error.stack,
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      requestId,
    });
  }
}
