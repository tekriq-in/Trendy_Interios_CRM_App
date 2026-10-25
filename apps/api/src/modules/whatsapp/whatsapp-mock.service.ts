import { Injectable, Logger } from '@nestjs/common';
import { IWhatsAppService } from './whatsapp.interface';

@Injectable()
export class WhatsAppMockService implements IWhatsAppService {
  private readonly logger = new Logger('WhatsApp[mock]');

  async sendTemplate(to: string, templateName: string, params: string[], language = 'en'): Promise<string> {
    this.logger.log(`[MOCK] sendTemplate to=${to} template=${templateName} lang=${language} params=${JSON.stringify(params)}`);
    return `mock-wamid-${Date.now()}`;
  }

  async sendMessage(to: string, body: string) {
    this.logger.log(`[MOCK] sendMessage to=${to}\n---\n${body}\n---`);
  }
}
