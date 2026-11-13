import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlockersService } from './blockers.service';
import { BlockersController } from './blockers.controller';
import { Blocker, BlockerSchema } from './schemas/blocker.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Blocker.name, schema: BlockerSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
    ActivityLogModule,
  ],
  providers: [BlockersService],
  controllers: [BlockersController],
  exports: [BlockersService],
})
export class BlockersModule {}
