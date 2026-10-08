import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchaseItemsService } from './purchase-items.service';
import { PurchaseItemsController } from './purchase-items.controller';
import { PurchaseItem, PurchaseItemSchema } from './schemas/purchase-item.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PurchaseItem.name, schema: PurchaseItemSchema }]),
    ActivityLogModule,
  ],
  providers: [PurchaseItemsService],
  controllers: [PurchaseItemsController],
  exports: [PurchaseItemsService],
})
export class PurchaseItemsModule {}
