import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HandoversService } from './handovers.service';
import { HandoversController } from './handovers.controller';
import { Handover, HandoverSchema } from './schemas/handover.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { ProjectAccessModule } from '../../common/access/project-access.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Handover.name, schema: HandoverSchema }]),
    ActivityLogModule,
    ProjectAccessModule,
  ],
  providers: [HandoversService],
  controllers: [HandoversController],
  exports: [HandoversService],
})
export class HandoversModule {}
