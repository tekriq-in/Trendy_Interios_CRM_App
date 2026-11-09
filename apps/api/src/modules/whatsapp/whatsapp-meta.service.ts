import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IWhatsAppService } from './whatsapp.interface';

@Injectable()
export class WhatsAppMetaService implements IWhatsAppService {
  private readonly logger = new Logger('WhatsApp[meta]');

  constructor(private readonly config: ConfigService) {}

  async sendTemplate(to: string, templateName: string, params: string[], language = 'en'): Promise<string> {
    const token = this.config.get('WHATSAPP_API_TOKEN');
    const phoneNumberId = this.config.get('WHATSAPP_PHONE_NUMBER_ID');
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language === 'ta' ? 'ta' : 'en' },
        components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }],
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      this.logger.error(`Meta API error: ${res.status} ${await res.text()}`);
      return '';
    }
    const json = await res.json() as { messages?: Array<{ id: string }> };
    return json.messages?.[0]?.id ?? '';
  }

  async sendMessage(to: string, message: string) {
    const token = this.config.get('WHATSAPP_API_TOKEN');
    const phoneNumberId = this.config.get('WHATSAPP_PHONE_NUMBER_ID');
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      this.logger.error(`Meta API sendMessage error: ${res.status} ${await res.text()}`);
    }
  }

  async sendDocument(to: string, documentUrl: string, fileName: string, caption?: string) {
    const token = this.config.get('WHATSAPP_API_TOKEN');
    const phoneNumberId = this.config.get('WHATSAPP_PHONE_NUMBER_ID');
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: { link: documentUrl, filename: fileName, ...(caption ? { caption } : {}) },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      this.logger.error(`Meta API sendDocument error: ${res.status} ${await res.text()}`);
    }
  }
}
