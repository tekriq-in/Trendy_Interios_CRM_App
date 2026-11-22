import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { ChatGroupsModule } from '../chat-groups/chat-groups.module';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
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
import { SlaSettings, SlaSettingsSchema } from '../sla/schemas/sla-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
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
      { name: SlaSettings.name, schema: SlaSettingsSchema },
    ]),
    ActivityLogModule,
    ChatGroupsModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
