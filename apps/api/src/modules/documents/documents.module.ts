import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { TIDocument, TIDocumentSchema } from './schemas/document.schema';
import { DriveModule } from '../drive/drive.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TIDocument.name, schema: TIDocumentSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
    DriveModule,
    ActivityLogModule,
  ],
  providers: [DocumentsService],
  controllers: [DocumentsController],
  exports: [DocumentsService, MongooseModule],
})
export class DocumentsModule {}
