import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SlaService } from './sla.service';
import { SlaController } from './sla.controller';
import { SlaSettings, SlaSettingsSchema } from './schemas/sla-settings.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Blocker, BlockerSchema } from '../blockers/schemas/blocker.schema';
import { Department, DepartmentSchema } from '../departments/schemas/department.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SlaSettings.name, schema: SlaSettingsSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Blocker.name, schema: BlockerSchema },
      { name: Department.name, schema: DepartmentSchema },
    ]),
    ActivityLogModule,
  ],
  providers: [SlaService],
  controllers: [SlaController],
  exports: [SlaService],
})
export class SlaModule {}
