export interface IWhatsAppService {
  /** Send a pre-approved template. Returns the wamid (Meta message ID) or empty string on failure. */
  sendTemplate(to: string, templateName: string, params: string[], language?: string): Promise<string>;
  /** Free-form send — only valid within the 24h customer-service window. */
  sendMessage(to: string, body: string): Promise<void>;
  /** Send a document (PDF etc.) by public URL. */
  sendDocument(to: string, documentUrl: string, fileName: string, caption?: string): Promise<void>;
}
export const WHATSAPP_SERVICE = 'WHATSAPP_SERVICE';
