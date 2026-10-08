import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WHATSAPP_SERVICE } from './whatsapp.interface';
import { WhatsAppMockService } from './whatsapp-mock.service';
import { WhatsAppMetaService } from './whatsapp-meta.service';

@Module({
  providers: [
    WhatsAppMockService,
    WhatsAppMetaService,
    {
      provide: WHATSAPP_SERVICE,
      inject: [ConfigService, WhatsAppMockService, WhatsAppMetaService],
      useFactory: (config: ConfigService, mock: WhatsAppMockService, meta: WhatsAppMetaService) =>
        config.get('WHATSAPP_PROVIDER') === 'meta' ? meta : mock,
    },
  ],
  exports: [WHATSAPP_SERVICE],
})
export class WhatsAppModule {}
