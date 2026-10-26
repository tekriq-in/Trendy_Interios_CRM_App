import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly db: Connection) {}

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
}
