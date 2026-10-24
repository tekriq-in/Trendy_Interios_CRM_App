import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatGroup, ChatGroupSchema } from './chat-group.schema';
import { ChatGroupsService } from './chat-groups.service';
import { ChatGroupsController } from './chat-groups.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: ChatGroup.name, schema: ChatGroupSchema }])],
  controllers: [ChatGroupsController],
  providers: [ChatGroupsService],
  exports: [ChatGroupsService],
})
export class ChatGroupsModule {}
