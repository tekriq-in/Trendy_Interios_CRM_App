import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestContext } from './common/middleware/request-id.middleware';
import { validateProductionEnv } from './common/utils/validate-production-env';

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
    const problems = validateProductionEnv(process.env);
    if (problems.length > 0) {
      throw new Error(`Unsafe production configuration:\n - ${problems.join('\n - ')}`);
    }
    if (process.env.WHATSAPP_PROVIDER === 'meta') {
      requireEnv('WHATSAPP_API_TOKEN');
      requireEnv('WHATSAPP_PHONE_NUMBER_ID');
      requireEnv('WA_VERIFY_TOKEN');
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // needed for webhook HMAC signature verification
  });

  // Render (and most PaaS hosts) terminate TLS at a reverse proxy. Trust one
  // hop so req.ip / req.protocol reflect the real client. Without this the
  // rate limiter would see every user as the proxy's IP and throttle them
  // all together.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Let SIGTERM (sent on every Render deploy) drain in-flight requests and
  // close the Mongo connection instead of dropping them.
  app.enableShutdownHooks();

  app.use(requestContext);
  app.useGlobalFilters(new AllExceptionsFilter());

  app.use(
    helmet({
      // Allow cross-origin resource loading so browser fetch/XHR to this API
      // isn't blocked when the web app runs on a different port in development.
      crossOriginResourcePolicy: process.env.NODE_ENV === 'production'
        ? { policy: 'same-origin' }
        : false,
    }),
  );
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/(.*)'], // health checks (incl. /live, /ready) have no prefix
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
      if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
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
