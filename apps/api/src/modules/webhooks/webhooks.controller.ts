import { Controller, Get, Post, Query, Body, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly config: ConfigService,
  ) {}

  /** Meta webhook verification handshake */
  @Get('whatsapp')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): number {
    const expected = this.config.get<string>('WA_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === expected) {
      this.logger.log('WhatsApp webhook verified');
      return Number(challenge);
    }
    throw new ForbiddenException('Invalid verify token');
  }

  /** Inbound messages and delivery status updates from Meta */
  @Post('whatsapp')
  async receive(@Body() body: Record<string, unknown>): Promise<{ status: string }> {
    await this.webhooksService.handleInbound(body as never);
    return { status: 'ok' };
  }
}
