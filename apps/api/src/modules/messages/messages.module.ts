import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Message, MessageSchema } from './messages.schema';
import { MessagesGateway } from './messages.gateway';
import { MessagesController } from './messages.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => ({ secret: cs.get('JWT_SECRET') }),
    }),
  ],
  controllers: [MessagesController],
  providers: [MessagesGateway],
  exports: [MessagesGateway],
})
export class MessagesModule {}
