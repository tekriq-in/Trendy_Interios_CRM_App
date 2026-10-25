import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { ClientMessage, ClientMessageSchema } from './client-message.schema';
import { Client, ClientSchema } from '../clients/schemas/client.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Approval, ApprovalSchema } from '../approvals/schemas/approval.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClientMessage.name, schema: ClientMessageSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Approval.name, schema: ApprovalSchema },
    ]),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
