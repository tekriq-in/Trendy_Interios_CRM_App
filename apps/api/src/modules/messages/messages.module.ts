import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Message, MessageSchema } from './messages.schema';
import { MessagesGateway } from './messages.gateway';
import { MessagesController } from './messages.controller';
import { ChatGroupsModule } from '../chat-groups/chat-groups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
import { ChatGroup, ChatGroupSchema } from '../chat-groups/chat-group.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: ChatGroup.name, schema: ChatGroupSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => ({ secret: cs.get('JWT_SECRET') }),
    }),
    ChatGroupsModule,
    NotificationsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesGateway],
  exports: [MessagesGateway],
})
export class MessagesModule {}
