import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(@InjectModel('User') private userModel: Model<Record<string, unknown>>) {}

  @Post('register-token')
  async registerToken(@Request() req: { user: { _id: string } }, @Body('fcmToken') fcmToken: string) {
    await this.userModel.findByIdAndUpdate(req.user._id, { fcmToken });
    return { ok: true };
  }
}
