import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GenerateMessageDto {
  rawNotes: string;
  clientName: string;
  projectTitle: string;
  updateKind: string;
  language?: 'en' | 'ta';
}

export interface GenerateMessageResult {
  message: string;
  translatedNotes?: string;
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
When Tamil is requested, write the entire message in natural Tamil using Tamil script. Translate the staff notes into Tamil; do not copy English sentences from the notes into the message. Proper names and project names may remain as written.

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

  async generate(dto: GenerateMessageDto): Promise<GenerateMessageResult> {
    const prompt = buildPrompt(dto);
    let message: string;

    // Never present the mock Tamil template as a translation: it embeds the
    // original English notes and can look like a successful Tamil translation.
    if (dto.language === 'ta') {
      try {
        message = await this.callConfiguredProvider(prompt);
        if (!this.isPredominantlyTamil(message)) {
          throw new Error('The generated message was not predominantly Tamil.');
        }

        const translatedNotes = await this.translateNotes(dto.rawNotes);
        return { message, translatedNotes };
      } catch (e) {
        this.logger.warn(`Tamil generation failed: ${(e as Error).message}`);
        throw new ServiceUnavailableException(
          'Tamil generation is unavailable or returned English text. Check the AI provider configuration and try again.',
        );
      }
    }

    if (this.provider === 'gemini' && this.geminiKey) {
      try { message = await this.callGemini(prompt); }
      catch (e) {
        this.logger.warn(`Gemini failed, falling back: ${(e as Error).message}`);
        message = this.mockMessage(dto);
      }
    } else if (this.provider === 'groq' && this.groqKey) {
      try { message = await this.callGroq(prompt); }
      catch (e) {
        this.logger.warn(`Groq failed, falling back: ${(e as Error).message}`);
        message = this.mockMessage(dto);
      }
    } else if (this.geminiKey && this.provider !== 'mock') {
      try { message = await this.callGemini(prompt); }
      catch { message = this.mockMessage(dto); }
    } else {
      message = this.mockMessage(dto);
    }

    return { message };
  }

  private async translateNotes(text: string): Promise<string> {
    const prompt = `Translate the following staff note into natural Tamil. Write only in Tamil script, preserving its meaning. Do not repeat the English source or add an explanation. Proper names may remain in English.\n\n${text}`;
    const translated = await this.callConfiguredProvider(prompt);
    if (!this.isPredominantlyTamil(translated)) {
      throw new Error('The staff notes translation was not predominantly Tamil.');
    }
    return translated;
  }

  private async callConfiguredProvider(prompt: string): Promise<string> {
    const configuredProviders = this.provider === 'gemini'
      ? [
          { name: 'Gemini', available: Boolean(this.geminiKey), call: () => this.callGemini(prompt) },
          { name: 'Groq', available: Boolean(this.groqKey), call: () => this.callGroq(prompt) },
        ]
      : this.provider === 'groq'
        ? [
            { name: 'Groq', available: Boolean(this.groqKey), call: () => this.callGroq(prompt) },
            { name: 'Gemini', available: Boolean(this.geminiKey), call: () => this.callGemini(prompt) },
          ]
        : [];
    let lastError: Error | undefined;

    for (const provider of configuredProviders) {
      if (!provider.available) continue;
      try {
        const output = await provider.call();
        if (!this.isPredominantlyTamil(output)) {
          throw new Error(`${provider.name} returned text that was not predominantly Tamil.`);
        }
        return output;
      } catch (e) {
        lastError = e as Error;
        this.logger.warn(`${provider.name} Tamil generation failed: ${lastError.message}`);
      }
    }

    throw lastError ?? new Error('No live Tamil AI provider is configured.');
  }

  private isPredominantlyTamil(text: string): boolean {
    const tamilLetters = (text.match(/[\u0B80-\u0BFF]/g) ?? []).length;
    const latinLetters = (text.match(/[A-Za-z]/g) ?? []).length;
    return tamilLetters >= 3 && tamilLetters > latinLetters;
  }

  private async callGemini(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${this.geminiKey}`;
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
        model: 'qwen/qwen3.8-27b',
        messages: [
          { role: 'system', content: 'You are a professional customer communication assistant.' },
          { role: 'user', content: prompt },
        ],
        max_completion_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0].message.content.trim();
  }

  private mockMessage(dto: GenerateMessageDto): string {  // returns only the WhatsApp message string
    const kindLabel = KIND_LABELS[dto.updateKind] ?? dto.updateKind;
    if (dto.language === 'ta') {
      return `அன்புள்ள ${dto.clientName} அவர்களே,

வணக்கம். "${dto.projectTitle}" திட்டம் தொடர்பாக ஒரு முக்கியமான தகவல் தெரிவிக்க விரும்புகிறோம்.

${dto.rawNotes}

உங்கள் நம்பிக்கைக்கு நன்றி. ஏதேனும் கேள்விகள் இருந்தால் எங்களை தொடர்பு கொள்ளவும்.

— டீம் ட்ரெண்டி இன்டீரியோஸ்`;
    }
    return `Dear ${dto.clientName},

We hope this message finds you well. We wanted to share a quick update regarding your project "${dto.projectTitle}".

${dto.rawNotes}

We appreciate your trust in us and remain committed to delivering excellent results. Please feel free to reach out if you have any questions.

— Team Trendy Interios`;
  }
}
