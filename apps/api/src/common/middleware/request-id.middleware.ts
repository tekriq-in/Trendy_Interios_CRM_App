import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

// Paths hit constantly by orchestrators; logging them is just noise.
const QUIET_PATHS = new Set(['/health', '/health/live', '/health/ready']);

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Assigns every request an id (honouring a sane inbound `x-request-id` from
 * the proxy/client), echoes it back in the response header, and writes one
 * access-log line per request. The query string is deliberately not logged
 * because it can carry tokens or personal data.
 */
export function requestContext(
  req: Request & { id?: string },
  res: Response,
  next: NextFunction,
): void {
  const inbound = req.headers['x-request-id'];
  const id = typeof inbound === 'string' && SAFE_ID.test(inbound) ? inbound : randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);

  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0];
    if (QUIET_PATHS.has(path)) return;
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const line = `${req.method} ${path} ${res.statusCode} ${ms.toFixed(0)}ms id=${id}`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });

  next();
}
