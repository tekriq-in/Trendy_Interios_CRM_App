import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly db: Connection) {}

  /** Combined status, kept for backwards compatibility (never throws). */
  @Get()
  check() {
    const dbReady = this.db.readyState === 1;
    return {
      status: dbReady ? 'ok' : 'degraded',
      db: dbReady ? 'connected' : 'disconnected',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Liveness: the process is up and the event loop responds. Must NOT depend
   * on the database, otherwise a Mongo blip makes the orchestrator restart a
   * perfectly healthy API in a loop.
   */
  @Get('live')
  live() {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }

  /**
   * Readiness: the API can actually serve traffic. Returns 503 while the DB
   * is disconnected so Render keeps routing to the previous healthy instance
   * during a deploy instead of switching over to a broken one.
   */
  @Get('ready')
  async ready() {
    if (this.db.readyState !== 1 || !this.db.db) {
      throw new ServiceUnavailableException({ status: 'unavailable', db: 'disconnected' });
    }
    try {
      await this.db.db.admin().ping();
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable', db: 'unreachable' });
    }
    return { status: 'ok', db: 'connected' };
  }
}
