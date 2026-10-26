import { Controller, Get, Post, Patch, Param, Query, Body, Headers, RawBodyRequest, Req, UseGuards, ForbiddenException, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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
  async receive(
    @Headers('x-hub-signature-256') sig: string,
    @Req() req: RawBodyRequest<{ rawBody?: Buffer }>,
    @Body() body: Record<string, unknown>,
  ): Promise<{ status: string }> {
    const appSecret = this.config.get<string>('META_APP_SECRET');
    if (appSecret) {
      if (!sig) throw new ForbiddenException('Missing signature');
      const rawBody = req.rawBody;
      if (!rawBody) throw new ForbiddenException('Raw body unavailable');
      const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        throw new ForbiddenException('Invalid signature');
      }
    }
    await this.webhooksService.handleInbound(body as never);
    return { status: 'ok' };
  }

  /** Client reply inbox — authenticated MD/GM endpoint */
  @UseGuards(JwtAuthGuard)
  @Get('client-messages')
  findClientMessages() {
    return this.webhooksService.findClientMessages();
  }

  /** Mark a client message as read */
  @UseGuards(JwtAuthGuard)
  @Patch('client-messages/:id/read')
  async markRead(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.webhooksService.markMessageRead(id);
    return { ok: true };
  }
}
