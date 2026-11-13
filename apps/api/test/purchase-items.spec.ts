import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  PERMISSIONS,
  derivePurchaseItemStatus,
  purchaseItemBalance,
  purchaseItemMatchKey,
} from '@ti/shared';
import { PurchaseItemsService } from '../src/modules/purchase-items/purchase-items.service';
import { PurchaseItemsPdfService } from '../src/modules/purchase-items/purchase-items-pdf.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';

describe('Purchase item rules (shared)', () => {
  it('matches on all six fields, ignoring case and extra spaces', () => {
    const a = purchaseItemMatchKey({ area: 'Kitchen', item: 'Hinge', brand: 'Hettich', code: 'H-35', size: '35mm', finish: 'SS' });
    const b = purchaseItemMatchKey({ area: ' kitchen ', item: 'HINGE', brand: 'hettich', code: 'h-35', size: '35MM', finish: 'ss' });
    const otherArea = purchaseItemMatchKey({ area: 'Wardrobe', item: 'Hinge', brand: 'Hettich', code: 'H-35', size: '35mm', finish: 'SS' });
    expect(a).toBe(b);
    expect(a).not.toBe(otherArea);
  });

  it('computes balance = order - received, never negative', () => {
    expect(purchaseItemBalance(15, 10)).toBe(5);
    expect(purchaseItemBalance(10, 10)).toBe(0);
    expect(purchaseItemBalance(0.3, 0.1)).toBe(0.2);
  });

  it('derives status from quantities', () => {
    expect(derivePurchaseItemStatus(10, 10, undefined, 'ordered')).toBe('received');
    expect(derivePurchaseItemStatus(10, 6, undefined, 'ordered')).toBe('ordered');
    expect(derivePurchaseItemStatus(15, 10, undefined, 'received')).toBe('pending');
    expect(derivePurchaseItemStatus(10, 0, 'ordered', 'pending')).toBe('ordered');
  });
});

describe('PurchaseItemsService', () => {
  let service: PurchaseItemsService;
  const projectId = new Types.ObjectId().toHexString();
  const md = { _id: new Types.ObjectId().toHexString(), rolePermissions: [PERMISSIONS.PROJECTS_READ_ALL] };
  const employee = { _id: new Types.ObjectId().toHexString(), rolePermissions: [PERMISSIONS.PROJECTS_READ_OWN] };

  const chain = (value: unknown) => ({
    sort: () => ({ select: () => ({ lean: () => Promise.resolve(value) }) }),
  });

  const itemModel = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findById: jest.fn(),
    exists: jest.fn(),
  };
  const projectModel = { exists: jest.fn(), findById: jest.fn() };
  const activityLog = { record: jest.fn() };

  function makeDoc(fields: Record<string, unknown>) {
    const doc: Record<string, unknown> = {
      _id: new Types.ObjectId(),
      project: new Types.ObjectId(projectId),
      area: 'Kitchen', item: 'Hinge', brand: '', code: '', size: '', finish: '',
      matchKey: purchaseItemMatchKey({ area: 'Kitchen', item: 'Hinge' }),
      ...fields,
    };
    doc.save = jest.fn().mockResolvedValue(doc);
    doc.toObject = () => ({ ...doc });
    return doc;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    projectModel.exists.mockResolvedValue({ _id: projectId });
    itemModel.findOne.mockReturnValue(chain({ slNo: 3 }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseItemsService,
        { provide: getModelToken('PurchaseItem'), useValue: itemModel },
        { provide: getModelToken('Project'), useValue: projectModel },
        { provide: ActivityLogService, useValue: activityLog },
        { provide: PurchaseItemsPdfService, useValue: { generate: jest.fn() } },
      ],
    }).compile();
    service = module.get(PurchaseItemsService);
  });

  it('adds quantity cumulatively to the matching row and resets it to "Yet to order"', async () => {
    const merged = makeDoc({ quantity: 4, receivedQty: 0, status: 'pending', slNo: 1 });
    itemModel.findOneAndUpdate.mockResolvedValue({ value: merged, lastErrorObject: { updatedExisting: true } });

    const result = await service.add(projectId, { area: 'Kitchen', item: ' hinge ', quantity: 2 }, md);

    const [filter, update, options] = itemModel.findOneAndUpdate.mock.calls[0];
    expect(filter.matchKey).toBe(purchaseItemMatchKey({ area: 'Kitchen', item: 'Hinge' }));
    expect(update.$inc).toEqual({ quantity: 2 });
    expect(update.$set).toEqual({ status: 'pending' });
    expect(update.$setOnInsert.slNo).toBe(4);
    expect(options.upsert).toBe(true);
    expect(result.merged).toBe(true);
    expect(result.quantity).toBe(4);
    expect(activityLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'purchase_item.quantity_added' }));
  });

  it('shows "10 received, 5 balance" after Design adds 5 to a fully received row', async () => {
    const row = makeDoc({ quantity: 15, receivedQty: 10, status: 'pending' });
    itemModel.findOneAndUpdate.mockResolvedValue({ value: row, lastErrorObject: { updatedExisting: true } });

    const result = await service.add(projectId, { area: 'Kitchen', item: 'Hinge', quantity: 5 }, md);
    expect(result.receivedQty).toBe(10);
    expect(result.balanceQty).toBe(5);
    expect(result.status).toBe('pending');
  });

  it('keeps an ordered row "Ordered" on partial receipt and marks it Received when complete', async () => {
    const row = makeDoc({ quantity: 10, receivedQty: 0, status: 'ordered' });
    itemModel.findById.mockResolvedValue(row);

    const partial = await service.updateProgress(String(row._id), { receivedQty: 6 }, md);
    expect(partial.status).toBe('ordered');
    expect(partial.balanceQty).toBe(4);

    const full = await service.updateProgress(String(row._id), { receivedQty: 10 }, md);
    expect(full.status).toBe('received');
    expect(full.balanceQty).toBe(0);
  });

  it('rejects a received qty above the order qty', async () => {
    itemModel.findById.mockResolvedValue(makeDoc({ quantity: 10, receivedQty: 0, status: 'ordered' }));
    await expect(service.updateProgress('507f1f77bcf86cd799439011', { receivedQty: 11 }, md))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects lowering the order qty below what was already received', async () => {
    itemModel.findById.mockResolvedValue(makeDoc({ quantity: 10, receivedQty: 8, status: 'ordered' }));
    await expect(service.updateDetails('507f1f77bcf86cd799439011', { quantity: 5 }, md))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('scopes employees to their assigned projects', async () => {
    projectModel.exists.mockResolvedValue(null);
    await expect(service.add(projectId, { item: 'Hinge', quantity: 1 }, employee))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(projectModel.exists).toHaveBeenCalledWith(
      expect.objectContaining({ assignedTeam: new Types.ObjectId(employee._id) }),
    );
    expect(itemModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
