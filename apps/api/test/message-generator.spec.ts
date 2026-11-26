import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MessageGeneratorService } from '../src/modules/message-generator/message-generator.service';

describe('MessageGeneratorService', () => {
  let service: MessageGeneratorService;
  const config = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        LLM_PROVIDER: 'groq',
        GROQ_API_KEY: 'test-key',
      };
      return values[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageGeneratorService,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<MessageGeneratorService>(MessageGeneratorService);
    jest.restoreAllMocks();
  });

  it('uses a Tamil closing and accepts Tamil content with English proper names', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            content: 'அன்புள்ள Priya அவர்களே, உங்கள் திட்டப் பணி சிறப்பாக முன்னேறுகிறது. — டீம் ட்ரெண்டி இன்டீரியோஸ்',
          },
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: 'நாளை வேலை தொடரும்.' } }],
      }), { status: 200 }));

    const result = await service.generate({
      rawNotes: 'Work resumes tomorrow.',
      clientName: 'Priya',
      projectTitle: 'Kitchen project',
      updateKind: 'client_update',
      language: 'ta',
    });

    expect(result.message).toContain('— டீம் ட்ரெண்டி இன்டீரியோஸ்');
    expect(result.translatedNotes).toBe('நாளை வேலை தொடரும்.');

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(requestBody.messages[1].content).toContain('— டீம் ட்ரெண்டி இன்டீரியோஸ்');
    expect(requestBody.messages[1].content).not.toContain('— Team Trendy Interios');
  });

  it('does not accept an English response for Tamil generation', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: 'Dear Priya, your project is progressing well.' } }],
    }), { status: 200 }));

    await expect(service.generate({
      rawNotes: 'Work resumes tomorrow.',
      clientName: 'Priya',
      projectTitle: 'Kitchen project',
      updateKind: 'client_update',
      language: 'ta',
    })).rejects.toThrow('Tamil generation is unavailable or returned English text.');
  });
});
