import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HandoversService } from './handovers.service';
import { HandoversController } from './handovers.controller';
import { Handover, HandoverSchema } from './schemas/handover.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Handover.name, schema: HandoverSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
    ActivityLogModule,
  ],
  providers: [HandoversService],
  controllers: [HandoversController],
  exports: [HandoversService],
})
export class HandoversModule {}
