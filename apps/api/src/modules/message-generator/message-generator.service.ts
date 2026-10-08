import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GenerateMessageDto {
  rawNotes: string;
  clientName: string;
  projectTitle: string;
  updateKind: string;
  language?: 'en' | 'ta';
}

const KIND_LABELS: Record<string, string> = {
  quotation: 'quotation ready for review',
  order_confirmation: 'order confirmed',
  client_update: 'project progress update',
  drawing: 'design drawing ready',
};

function buildPrompt(dto: GenerateMessageDto): string {
  const lang = dto.language === 'ta' ? 'Tamil' : 'English';
  const kindLabel = KIND_LABELS[dto.updateKind] ?? dto.updateKind;
  return `You are a professional customer communication assistant for Trendy Interios, an interior design company in Chennai, India.

Write a polite, warm WhatsApp message in ${lang} to send to the client. Keep it under 140 words.

Details:
- Client name: ${dto.clientName}
- Project: ${dto.projectTitle}
- Update type: ${kindLabel}
- Staff notes: ${dto.rawNotes}

Rules:
- Address the client by name
- Be professional yet warm (Chennai business tone)
- Do not invent dates or promises not in the staff notes
- End the message with "— Team Trendy Interios"
- Plain text only (no markdown, no asterisks for bold)
- Output only the message, nothing else`;
}

@Injectable()
export class MessageGeneratorService {
  private readonly logger = new Logger(MessageGeneratorService.name);
  private readonly provider: string;
  private readonly geminiKey: string;
  private readonly groqKey: string;

  constructor(private config: ConfigService) {
    this.provider = config.get<string>('LLM_PROVIDER', 'mock');
    this.geminiKey = config.get<string>('GEMINI_API_KEY', '');
    this.groqKey = config.get<string>('GROQ_API_KEY', '');
  }

  async generate(dto: GenerateMessageDto): Promise<string> {
    const prompt = buildPrompt(dto);

    if (this.provider === 'gemini' && this.geminiKey) {
      try { return await this.callGemini(prompt); } catch (e) {
        this.logger.warn(`Gemini failed, falling back to mock: ${(e as Error).message}`);
      }
    }

    if (this.provider === 'groq' && this.groqKey) {
      try { return await this.callGroq(prompt); } catch (e) {
        this.logger.warn(`Groq failed, falling back to mock: ${(e as Error).message}`);
      }
    }

    // auto-fallback to Gemini if key present regardless of provider setting
    if (this.geminiKey && this.provider !== 'mock') {
      try { return await this.callGemini(prompt); } catch { /* fall through */ }
    }

    return this.mockMessage(dto);
  }

  private async callGemini(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);

    const data = await res.json() as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    return data.candidates[0].content.parts[0].text.trim();
  }

  private async callGroq(prompt: string): Promise<string> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are a professional customer communication assistant.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0].message.content.trim();
  }

  private mockMessage(dto: GenerateMessageDto): string {
    const kindLabel = KIND_LABELS[dto.updateKind] ?? dto.updateKind;
    return `Dear ${dto.clientName},

We hope this message finds you well. We wanted to share a quick update regarding your project "${dto.projectTitle}".

${dto.rawNotes}

We appreciate your trust in us and remain committed to delivering excellent results. Please feel free to reach out if you have any questions.

— Team Trendy Interios`;
  }
}
