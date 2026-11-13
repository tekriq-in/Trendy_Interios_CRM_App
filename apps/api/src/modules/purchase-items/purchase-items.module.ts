import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchaseItemsService } from './purchase-items.service';
import { PurchaseItemsController } from './purchase-items.controller';
import { PurchaseItemsPdfService } from './purchase-items-pdf.service';
import { PurchaseItem, PurchaseItemSchema } from './schemas/purchase-item.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PurchaseItem.name, schema: PurchaseItemSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
    ActivityLogModule,
  ],
  providers: [PurchaseItemsService, PurchaseItemsPdfService],
  controllers: [PurchaseItemsController],
  exports: [PurchaseItemsService],
})
export class PurchaseItemsModule {}
