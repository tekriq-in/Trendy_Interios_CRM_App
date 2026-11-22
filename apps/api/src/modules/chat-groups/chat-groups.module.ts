import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatGroup, ChatGroupSchema } from './chat-group.schema';
import { Message, MessageSchema } from '../messages/messages.schema';
import { Department, DepartmentSchema } from '../departments/schemas/department.schema';
import { ChatGroupsService } from './chat-groups.service';
import { ChatGroupsController } from './chat-groups.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatGroup.name, schema: ChatGroupSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Department.name, schema: DepartmentSchema },
    ]),
  ],
  controllers: [ChatGroupsController],
  providers: [ChatGroupsService],
  exports: [ChatGroupsService],
})
export class ChatGroupsModule {}
