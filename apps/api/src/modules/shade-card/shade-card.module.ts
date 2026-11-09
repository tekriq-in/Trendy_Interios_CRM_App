import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShadeCardEntry, ShadeCardEntrySchema } from './schemas/shade-card.schema';
import { ShadeCardService } from './shade-card.service';
import { ShadeCardController } from './shade-card.controller';
import { ShadeCardPdfService } from './shade-card-pdf.service';
import { DriveModule } from '../drive/drive.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Approval, ApprovalSchema } from '../approvals/schemas/approval.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShadeCardEntry.name, schema: ShadeCardEntrySchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Approval.name, schema: ApprovalSchema },
    ]),
    DriveModule,
    WhatsAppModule,
  ],
  controllers: [ShadeCardController],
  providers: [ShadeCardService, ShadeCardPdfService],
  exports: [ShadeCardService],
})
export class ShadeCardModule {}
