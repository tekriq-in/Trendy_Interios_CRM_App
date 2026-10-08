import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { Approval, ApprovalSchema } from './schemas/approval.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { MessageGeneratorModule } from '../message-generator/message-generator.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Approval.name, schema: ApprovalSchema }]),
    ActivityLogModule,
    WhatsAppModule,
    MessageGeneratorModule,
  ],
  providers: [ApprovalsService],
  controllers: [ApprovalsController],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
