import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PurchaseItem, PurchaseItemDocument } from './schemas/purchase-item.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class PurchaseItemsService {
  constructor(
    @InjectModel(PurchaseItem.name) private itemModel: Model<PurchaseItemDocument>,
    private activityLog: ActivityLogService,
  ) {}

  findByProject(projectId: string) {
    return this.itemModel.find({ project: new Types.ObjectId(projectId) }).lean();
  }

  async create(
    projectId: string,
    dto: {
      item: string;
      description?: string;
      quantity: number;
      unit?: string;
      supplier?: string;
    },
    actorId: string,
  ) {
    const item = await this.itemModel.create({
      project: new Types.ObjectId(projectId),
      ...dto,
      createdBy: new Types.ObjectId(actorId),
    });

    await this.activityLog.record({
      actor: actorId,
      action: 'purchase_item.created',
      entity: 'purchaseItems',
      entityId: String(item._id),
    });

    return item;
  }

  async updateStatus(
    id: string,
    dto: { status: string; linkedDocumentId?: string },
    actorId: string,
  ) {
    const update: Record<string, unknown> = { status: dto.status };
    if (dto.status === 'ordered') update.orderedAt = new Date();
    if (dto.status === 'received') update.receivedAt = new Date();
    if (dto.linkedDocumentId) update.linkedDocument = new Types.ObjectId(dto.linkedDocumentId);

    const item = await this.itemModel.findByIdAndUpdate(id, update, { new: true });
    if (!item) throw new NotFoundException('purchase_item.not_found');

    await this.activityLog.record({
      actor: actorId,
      action: 'purchase_item.status_changed',
      entity: 'purchaseItems',
      entityId: id,
      metadata: { status: dto.status },
    });

    return item;
  }
}
