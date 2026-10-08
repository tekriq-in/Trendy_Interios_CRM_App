import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private app: App | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FCM_PROJECT_ID');
    const privateKey = this.configService.get<string>('FCM_PRIVATE_KEY');
    const clientEmail = this.configService.get<string>('FCM_CLIENT_EMAIL');
    if (!projectId || !privateKey || !clientEmail) {
      this.logger.warn('FCM not configured — push notifications disabled');
      return;
    }
    const existing = getApps();
    this.app =
      existing.length > 0
        ? existing[0]
        : initializeApp({
            credential: cert({
              projectId,
              privateKey: privateKey.replace(/\\n/g, '\n'),
              clientEmail,
            }),
          });
  }

  async sendToDevice(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.app) return;
    try {
      await getMessaging(this.app).send({ token: fcmToken, notification: { title, body }, data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`FCM send failed for token ${fcmToken}: ${msg}`);
    }
  }

  async sendToMany(
    fcmTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.app || fcmTokens.length === 0) return;
    const messages = fcmTokens.map((token) => ({ token, notification: { title, body }, data }));
    await getMessaging(this.app).sendEach(messages);
  }
}
