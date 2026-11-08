import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShadeCardEntry, ShadeCardEntrySchema } from './schemas/shade-card.schema';
import { ShadeCardService } from './shade-card.service';
import { ShadeCardController } from './shade-card.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: ShadeCardEntry.name, schema: ShadeCardEntrySchema }])],
  controllers: [ShadeCardController],
  providers: [ShadeCardService],
  exports: [ShadeCardService],
})
export class ShadeCardModule {}
