import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Model, Types } from 'mongoose';
import {
  PERMISSIONS,
  derivePurchaseItemStatus,
  purchaseItemBalance,
  purchaseItemMatchKey,
  purchaseItemYetToOrder,
} from '@ti/shared';
import { PurchaseItem, PurchaseItemDocument } from './schemas/purchase-item.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PurchaseItemsPdfService } from './purchase-items-pdf.service';
import {
  AddPurchaseItemDto,
  UpdatePurchaseItemDetailsDto,
  UpdatePurchaseItemProgressDto,
} from './dto/purchase-item.dto';

type Actor = { _id: string; rolePermissions: string[] };
type Status = PurchaseItem['status'];

interface LeanPurchaseItem {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  slNo?: number;
  area?: string;
  item: string;
  brand?: string;
  code?: string;
  size?: string;
  finish?: string;
  matchKey?: string;
  quantity: number;
  orderedQty?: number;
  receivedQty?: number;
  status: Status;
}

/** Shape returned to clients: stored fields plus the computed balance. */
export interface PurchaseItemView {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  slNo: number;
  area: string;
  item: string;
  brand: string;
  code: string;
  size: string;
  finish: string;
  quantity: number;
  orderedQty: number;
  receivedQty: number;
  yetToOrderQty: number;
  balanceQty: number;
  status: Status;
  orderedAt?: Date;
  receivedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const IDENTITY_FIELDS = ['area', 'item', 'brand', 'code', 'size', 'finish'] as const;

@Injectable()
export class PurchaseItemsService implements OnModuleInit {
  private readonly logger = new Logger(PurchaseItemsService.name);

  constructor(
    @InjectModel(PurchaseItem.name) private itemModel: Model<PurchaseItemDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    private activityLog: ActivityLogService,
    private pdf: PurchaseItemsPdfService,
  ) {}

  /** One-time backfills for rows created before quantity tracking existed. Idempotent. */
  async onModuleInit() {
    await this.backfillLegacyRows();
    await this.backfillOrderedQty();
  }

  private async backfillLegacyRows() {
    try {
      const legacy = (await this.itemModel
        .find({ matchKey: { $exists: false } })
        .sort({ createdAt: 1 })
        .lean()) as unknown as LeanPurchaseItem[];
      if (legacy.length === 0) return;

      const maxSlNo = new Map<string, number>();
      const ops: AnyBulkWriteOperation<PurchaseItemDocument>[] = [];
      for (const doc of legacy) {
        const pid = String(doc.project);
        if (!maxSlNo.has(pid)) {
          const top = await this.itemModel
            .findOne({ project: doc.project, matchKey: { $exists: true } })
            .sort({ slNo: -1 })
            .select('slNo')
            .lean();
          maxSlNo.set(pid, top?.slNo ?? 0);
        }
        const slNo = (maxSlNo.get(pid) ?? 0) + 1;
        maxSlNo.set(pid, slNo);

        const receivedQty = doc.status === 'received' ? doc.quantity : doc.receivedQty ?? 0;
        ops.push({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                slNo,
                receivedQty,
                area: doc.area ?? '',
                brand: doc.brand ?? '',
                code: doc.code ?? '',
                size: doc.size ?? '',
                finish: doc.finish ?? '',
                matchKey: purchaseItemMatchKey(doc),
              },
            },
          },
        });
      }
      await this.itemModel.bulkWrite(ops);
      this.logger.log(`Backfilled ${ops.length} legacy purchase item(s)`);
    } catch (err) {
      this.logger.error(`Purchase item backfill failed: ${(err as Error).message}`);
    }
  }

  /** Rows from before ordered qty was tracked: infer it from the old status. */
  private async backfillOrderedQty() {
    try {
      const rows = (await this.itemModel
        .find({ orderedQty: { $exists: false } })
        .select('_id quantity receivedQty status')
        .lean()) as unknown as LeanPurchaseItem[];
      if (rows.length === 0) return;

      const ops: AnyBulkWriteOperation<PurchaseItemDocument>[] = rows.map((r) => {
        const receivedQty = r.receivedQty ?? 0;
        const orderedQty = r.status === 'pending' ? receivedQty : Math.max(r.quantity, receivedQty);
        return {
          updateOne: {
            filter: { _id: r._id },
            update: { $set: { orderedQty, status: derivePurchaseItemStatus(r.quantity, orderedQty, receivedQty) } },
          },
        };
      });
      await this.itemModel.bulkWrite(ops);
      this.logger.log(`Backfilled ordered qty on ${ops.length} purchase item(s)`);
    } catch (err) {
      this.logger.error(`Ordered qty backfill failed: ${(err as Error).message}`);
    }
  }

  async findByProject(projectId: string, actor: Actor): Promise<PurchaseItemView[]> {
    await this.assertProjectAccess(projectId, actor);
    const items = (await this.itemModel
      .find({ project: new Types.ObjectId(projectId) })
      .sort({ slNo: 1, createdAt: 1 })
      .lean()) as unknown as PurchaseItemView[];
    return items.map((i) => this.toView(i));
  }

  /**
   * Design adds an item. If a row with the same Area + Item + Brand + Code + Size + Finish
   * already exists, the quantity is added to it (cumulative) and its balance goes back to
   * "Yet to order". Otherwise a new row is created with the next S.No.
   */
  async add(projectId: string, dto: AddPurchaseItemDto, actor: Actor): Promise<PurchaseItemView & { merged: boolean }> {
    await this.assertProjectAccess(projectId, actor);
    const project = new Types.ObjectId(projectId);
    const fields = {
      area: dto.area ?? '',
      item: dto.item,
      brand: dto.brand ?? '',
      code: dto.code ?? '',
      size: dto.size ?? '',
      finish: dto.finish ?? '',
    };
    const matchKey = purchaseItemMatchKey(fields);
    const slNo = await this.nextSlNo(project);

    const result = await this.itemModel.findOneAndUpdate(
      { project, matchKey },
      {
        $inc: { quantity: dto.quantity },
        $set: { status: 'pending' },
        // New quantity is never ordered yet, so the row is always "Yet to order" after an add
        $setOnInsert: { ...fields, orderedQty: 0, receivedQty: 0, slNo, createdBy: new Types.ObjectId(actor._id) },
      },
      { upsert: true, new: true, setDefaultsOnInsert: false, includeResultMetadata: true },
    );
    const saved = result.value;
    if (!saved) throw new BadRequestException('purchase_item.add_failed');
    const merged = Boolean(result.lastErrorObject?.updatedExisting);

    await this.activityLog.record({
      actor: actor._id,
      action: merged ? 'purchase_item.quantity_added' : 'purchase_item.created',
      entity: 'purchaseItems',
      entityId: String(saved._id),
      metadata: { item: saved.item, added: dto.quantity, orderQty: saved.quantity },
    });

    return { ...this.toView(saved.toObject() as unknown as PurchaseItemView), merged };
  }

  /** Design corrects the details or the order qty total. */
  async updateDetails(id: string, dto: UpdatePurchaseItemDetailsDto, actor: Actor): Promise<PurchaseItemView> {
    const item = await this.findOwned(id, actor);
    const before = { quantity: item.quantity, status: item.status };

    for (const field of IDENTITY_FIELDS) {
      const value = dto[field];
      if (value !== undefined) item[field] = value;
    }
    const matchKey = purchaseItemMatchKey(item);
    if (matchKey !== item.matchKey) {
      const clash = await this.itemModel.exists({ project: item.project, matchKey, _id: { $ne: item._id } });
      if (clash) throw new BadRequestException('purchase_item.duplicate');
      item.matchKey = matchKey;
    }

    if (dto.quantity !== undefined) {
      if (dto.quantity < item.receivedQty) {
        throw new BadRequestException('purchase_item.quantity_below_received');
      }
      if (dto.quantity < item.orderedQty) {
        throw new BadRequestException('purchase_item.quantity_below_ordered');
      }
      item.quantity = dto.quantity;
      this.applyStatus(item, derivePurchaseItemStatus(item.quantity, item.orderedQty, item.receivedQty));
    }

    await item.save();
    await this.activityLog.record({
      actor: actor._id,
      action: 'purchase_item.updated',
      entity: 'purchaseItems',
      entityId: id,
      metadata: { ...dto, previousQuantity: before.quantity },
    });
    return this.withBalance(item);
  }

  /**
   * Purchase records how many are ordered / received so far (totals, entered by hand).
   * Status follows from the numbers. Receiving more than was marked ordered raises the
   * ordered qty to match, since goods can't arrive without having been ordered.
   */
  async updateProgress(id: string, dto: UpdatePurchaseItemProgressDto, actor: Actor): Promise<PurchaseItemView> {
    if (dto.orderedQty === undefined && dto.receivedQty === undefined) {
      throw new BadRequestException('purchase_item.empty_update');
    }
    const item = await this.findOwned(id, actor);
    const before = { status: item.status, orderedQty: item.orderedQty, receivedQty: item.receivedQty };

    const receivedQty = dto.receivedQty ?? item.receivedQty;
    let orderedQty = dto.orderedQty ?? item.orderedQty;
    if (receivedQty > item.quantity) throw new BadRequestException('purchase_item.received_exceeds_order');
    if (orderedQty > item.quantity) throw new BadRequestException('purchase_item.ordered_exceeds_order');
    if (receivedQty > orderedQty) {
      if (dto.orderedQty !== undefined) throw new BadRequestException('purchase_item.ordered_below_received');
      orderedQty = receivedQty;
    }

    item.orderedQty = orderedQty;
    item.receivedQty = receivedQty;
    this.applyStatus(item, derivePurchaseItemStatus(item.quantity, orderedQty, receivedQty));

    await item.save();
    await this.activityLog.record({
      actor: actor._id,
      action: 'purchase_item.progress_updated',
      entity: 'purchaseItems',
      entityId: id,
      metadata: {
        fromStatus: before.status,
        toStatus: item.status,
        fromOrderedQty: before.orderedQty,
        toOrderedQty: item.orderedQty,
        fromReceivedQty: before.receivedQty,
        toReceivedQty: item.receivedQty,
      },
    });
    return this.withBalance(item);
  }

  /** Only rows with nothing ordered or received can be deleted. Remaining rows are renumbered. */
  async remove(id: string, actor: Actor): Promise<{ deleted: true }> {
    const item = await this.findOwned(id, actor);
    if (item.receivedQty > 0 || item.orderedQty > 0) {
      throw new BadRequestException('purchase_item.cannot_delete_in_progress');
    }
    await item.deleteOne();

    const rest = await this.itemModel
      .find({ project: item.project })
      .sort({ slNo: 1, createdAt: 1 })
      .select('_id slNo')
      .lean();
    const renumber = rest
      .map((r, idx) => ({ id: r._id, slNo: idx + 1, changed: r.slNo !== idx + 1 }))
      .filter((r) => r.changed)
      .map((r) => ({ updateOne: { filter: { _id: r.id }, update: { $set: { slNo: r.slNo } } } }));
    if (renumber.length) await this.itemModel.bulkWrite(renumber);

    await this.activityLog.record({
      actor: actor._id,
      action: 'purchase_item.deleted',
      entity: 'purchaseItems',
      entityId: id,
      metadata: { item: item.item, quantity: item.quantity },
    });
    return { deleted: true };
  }

  async exportPdf(projectId: string, actor: Actor): Promise<{ buffer: Buffer; fileName: string }> {
    const items = await this.findByProject(projectId, actor);
    const project = (await this.projectModel
      .findById(projectId)
      .populate('client', 'name')
      .select('title client')
      .lean()) as unknown as { title: string; client?: { name?: string } } | null;
    if (!project) throw new NotFoundException('project.not_found');

    const buffer = await this.pdf.generate(
      { title: project.title, clientName: project.client?.name },
      items.map((i) => ({
        slNo: i.slNo,
        area: i.area ?? '',
        item: i.item,
        brand: i.brand ?? '',
        code: i.code ?? '',
        size: i.size ?? '',
        finish: i.finish ?? '',
        quantity: i.quantity,
        orderedQty: i.orderedQty,
        receivedQty: i.receivedQty,
        balanceQty: i.balanceQty,
        status: i.status,
      })),
    );
    const safeTitle = project.title.replace(/[^\w-]+/g, '_').slice(0, 60);
    return { buffer, fileName: `Purchase_Items_${safeTitle}.pdf` };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private applyStatus(item: PurchaseItemDocument, next: Status) {
    if (next === item.status) return;
    if (next === 'ordered') item.orderedAt = new Date();
    if (next === 'received') item.receivedAt = new Date();
    item.status = next;
  }

  private withBalance(item: PurchaseItemDocument): PurchaseItemView {
    return this.toView(item.toObject() as unknown as PurchaseItemView);
  }

  private toView(i: PurchaseItemView): PurchaseItemView {
    const receivedQty = i.receivedQty ?? 0;
    const orderedQty = i.orderedQty ?? 0;
    return {
      ...i,
      slNo: i.slNo ?? 0,
      area: i.area ?? '',
      brand: i.brand ?? '',
      code: i.code ?? '',
      size: i.size ?? '',
      finish: i.finish ?? '',
      orderedQty,
      receivedQty,
      yetToOrderQty: purchaseItemYetToOrder(i.quantity, orderedQty),
      balanceQty: purchaseItemBalance(i.quantity, receivedQty),
    };
  }

  private async nextSlNo(project: Types.ObjectId): Promise<number> {
    const top = await this.itemModel.findOne({ project }).sort({ slNo: -1 }).select('slNo').lean();
    return (top?.slNo ?? 0) + 1;
  }

  private async findOwned(id: string, actor: Actor): Promise<PurchaseItemDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('purchase_item.not_found');
    const item = await this.itemModel.findById(id);
    if (!item) throw new NotFoundException('purchase_item.not_found');
    await this.assertProjectAccess(String(item.project), actor);
    return item;
  }

  /** Employees may only touch purchase items of projects they are assigned to. */
  private async assertProjectAccess(projectId: string, actor: Actor) {
    if (!Types.ObjectId.isValid(projectId)) throw new NotFoundException('project.not_found');
    const filter: Record<string, unknown> = { _id: new Types.ObjectId(projectId) };
    if (!actor.rolePermissions.includes(PERMISSIONS.PROJECTS_READ_ALL)) {
      filter.assignedTeam = new Types.ObjectId(actor._id);
    }
    const exists = await this.projectModel.exists(filter);
    if (!exists) throw new NotFoundException('project.not_found');
  }
}
