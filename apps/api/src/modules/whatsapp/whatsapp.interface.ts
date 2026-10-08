export interface IWhatsAppService {
  sendTemplate(to: string, templateName: string, params: string[]): Promise<void>;
}
export const WHATSAPP_SERVICE = 'WHATSAPP_SERVICE';
