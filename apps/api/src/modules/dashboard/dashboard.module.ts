import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Blocker, BlockerSchema } from '../blockers/schemas/blocker.schema';
import { Approval, ApprovalSchema } from '../approvals/schemas/approval.schema';
import { Task, TaskSchema } from '../tasks/schemas/task.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Blocker.name, schema: BlockerSchema },
      { name: Approval.name, schema: ApprovalSchema },
      { name: Task.name, schema: TaskSchema },
    ]),
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
