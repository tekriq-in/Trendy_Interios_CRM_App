import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { Client, ClientSchema } from './schemas/client.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Task, TaskSchema } from '../tasks/schemas/task.schema';
import { TIDocument, TIDocumentSchema } from '../documents/schemas/document.schema';
import { Handover, HandoverSchema } from '../handovers/schemas/handover.schema';
import { Blocker, BlockerSchema } from '../blockers/schemas/blocker.schema';
import { Approval, ApprovalSchema } from '../approvals/schemas/approval.schema';
import { PurchaseItem, PurchaseItemSchema } from '../purchase-items/schemas/purchase-item.schema';
import { ShadeCardEntry, ShadeCardEntrySchema } from '../shade-card/schemas/shade-card.schema';
import { ChatGroup, ChatGroupSchema } from '../chat-groups/chat-group.schema';
import { Message, MessageSchema } from '../messages/messages.schema';
import { ClientMessage, ClientMessageSchema } from '../webhooks/client-message.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Task.name, schema: TaskSchema },
      { name: TIDocument.name, schema: TIDocumentSchema },
      { name: Handover.name, schema: HandoverSchema },
      { name: Blocker.name, schema: BlockerSchema },
      { name: Approval.name, schema: ApprovalSchema },
      { name: PurchaseItem.name, schema: PurchaseItemSchema },
      { name: ShadeCardEntry.name, schema: ShadeCardEntrySchema },
      { name: ChatGroup.name, schema: ChatGroupSchema },
      { name: Message.name, schema: MessageSchema },
      { name: ClientMessage.name, schema: ClientMessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ActivityLogModule,
  ],
  providers: [ClientsService],
  controllers: [ClientsController],
  exports: [ClientsService, MongooseModule],
})
export class ClientsModule {}
