import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { requestContext } from '../src/common/middleware/request-id.middleware';
import { HealthController } from '../src/modules/health/health.controller';

function httpHost(req: Record<string, unknown>) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  const req = { id: 'req-12345678', method: 'GET', url: '/api/v1/x' };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps the existing HttpException body and adds the request id', () => {
    const { host, status, json } = httpHost(req);
    filter.catch(new BadRequestException('dashboard.invalid_date_range'), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'dashboard.invalid_date_range',
        requestId: 'req-12345678',
      }),
    );
  });

  it('hides internals of unexpected errors behind a generic 500', () => {
    const { host, status, json } = httpHost(req);
    filter.catch(new Error('E11000 duplicate key at mongodb://user:pass@host'), host);
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      requestId: 'req-12345678',
    });
    expect(JSON.stringify(body)).not.toContain('mongodb://');
  });

  it('handles non-Error throwables', () => {
    const { host, status } = httpHost(req);
    filter.catch('boom', host);
    expect(status).toHaveBeenCalledWith(500);
  });

  it('rethrows for non-HTTP contexts such as websockets', () => {
    const host = { getType: () => 'ws' } as unknown as ArgumentsHost;
    expect(() => filter.catch(new Error('ws'), host)).toThrow('ws');
  });
});

describe('requestContext middleware', () => {
  function run(headers: Record<string, string> = {}) {
    const req = { headers, method: 'GET', originalUrl: '/api/v1/projects?token=secret' } as never;
    const listeners: Record<string, () => void> = {};
    const res = {
      statusCode: 200,
      setHeader: jest.fn(),
      on: (event: string, cb: () => void) => {
        listeners[event] = cb;
      },
    } as never;
    const next = jest.fn();
    requestContext(req, res, next);
    return { req: req as { id?: string }, res: res as { setHeader: jest.Mock }, next, listeners };
  }

  it('generates an id, echoes it in the response and calls next', () => {
    const { req, res, next } = run();
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.id);
    expect(next).toHaveBeenCalled();
  });

  it('honours a well-formed inbound x-request-id', () => {
    const { req } = run({ 'x-request-id': 'abc12345-trace' });
    expect(req.id).toBe('abc12345-trace');
  });

  it('replaces a malformed inbound id (log-injection guard)', () => {
    const { req } = run({ 'x-request-id': 'bad id\nforged line' });
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not write the query string to the access log', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const { listeners } = run();
    listeners.finish();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).not.toContain('secret');
    log.mockRestore();
  });
});

describe('HealthController', () => {
  const make = (readyState: number, ping?: jest.Mock) =>
    new HealthController({
      readyState,
      db: ping ? { admin: () => ({ ping }) } : undefined,
    } as never);

  it('live() never depends on the database', () => {
    expect(make(0).live().status).toBe('ok');
  });

  it('check() reports degraded (not an error) when the DB is down', () => {
    expect(make(0).check().status).toBe('degraded');
    expect(make(1).check().status).toBe('ok');
  });

  it('ready() succeeds when Mongo answers a ping', async () => {
    await expect(make(1, jest.fn().mockResolvedValue({ ok: 1 })).ready()).resolves.toEqual({
      status: 'ok',
      db: 'connected',
      commit: expect.any(String), // lets the deploy workflow verify which build is live
    });
  });

  it('ready() returns 503 when disconnected', async () => {
    await expect(make(0).ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('ready() returns 503 when the ping fails', async () => {
    await expect(make(1, jest.fn().mockRejectedValue(new Error('x'))).ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
