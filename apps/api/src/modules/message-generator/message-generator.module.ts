import { Module } from '@nestjs/common';
import { MessageGeneratorService } from './message-generator.service';

@Module({
  providers: [MessageGeneratorService],
  exports: [MessageGeneratorService],
})
export class MessageGeneratorModule {}
