import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

async function bootstrap() {
  // Fail fast on missing critical env vars
  requireEnv('MONGODB_URI');
  requireEnv('JWT_SECRET');
  requireEnv('JWT_REFRESH_SECRET');
  if (process.env.NODE_ENV === 'production') {
    requireEnv('CORS_ORIGIN');
    if (process.env.WHATSAPP_PROVIDER === 'meta') {
      requireEnv('WHATSAPP_API_TOKEN');
      requireEnv('WHATSAPP_PHONE_NUMBER_ID');
      requireEnv('WA_VERIFY_TOKEN');
    }
  }

  const app = await NestFactory.create(AppModule, {
    rawBody: true, // needed for webhook HMAC signature verification
  });

  app.use(helmet());
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'], // health check has no prefix
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`API running on port ${port} (${process.env.NODE_ENV ?? 'development'})`);
}

bootstrap().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
