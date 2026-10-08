import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SlaService } from './sla.service';
import { SlaController } from './sla.controller';
import { SlaSettings, SlaSettingsSchema } from './schemas/sla-settings.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SlaSettings.name, schema: SlaSettingsSchema }]),
    ActivityLogModule,
  ],
  providers: [SlaService],
  controllers: [SlaController],
  exports: [SlaService],
})
export class SlaModule {}
