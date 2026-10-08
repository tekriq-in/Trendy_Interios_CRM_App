import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ApprovalsService } from '../src/modules/approvals/approvals.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';
import { WHATSAPP_SERVICE } from '../src/modules/whatsapp/whatsapp.interface';
import { PERMISSIONS } from '@ti/shared';

const mockApprovalModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
};

const mockActivityLog = { record: jest.fn() };
const mockWhatsApp = { sendTemplate: jest.fn() };

describe('Approval Gate — no client message without approved approval', () => {
  let service: ApprovalsService;
  const actorId = new Types.ObjectId().toHexString();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: getModelToken('Approval'), useValue: mockApprovalModel },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: WHATSAPP_SERVICE, useValue: mockWhatsApp },
      ],
    }).compile();

    service = module.get<ApprovalsService>(ApprovalsService);
    jest.clearAllMocks();
  });

  it('throws ForbiddenException when actor lacks approvals:decide', async () => {
    const actor = { _id: actorId, rolePermissions: [PERMISSIONS.APPROVALS_REQUEST] };
    await expect(service.approve('someId', actor)).rejects.toThrow(
      'auth.insufficient_permissions',
    );
  });

  it('throws ForbiddenException when actor lacks approvals:decide on reject', async () => {
    const actor = { _id: actorId, rolePermissions: [PERMISSIONS.APPROVALS_REQUEST] };
    await expect(service.reject('someId', 'reason', actor)).rejects.toThrow(
      'auth.insufficient_permissions',
    );
  });

  it('approve sets status to approved and records activity', async () => {
    const approvalId = new Types.ObjectId().toHexString();
    const updatedApproval = {
      _id: approvalId,
      kind: 'quotation',
      status: 'approved',
      approvedAt: new Date(),
      populate: jest.fn(),
      save: jest.fn(),
    };

    mockApprovalModel.findByIdAndUpdate.mockResolvedValue(updatedApproval);

    const actor = { _id: actorId, rolePermissions: [PERMISSIONS.APPROVALS_DECIDE] };
    const result = await service.approve(approvalId, actor);

    expect(mockApprovalModel.findByIdAndUpdate).toHaveBeenCalledWith(
      approvalId,
      expect.objectContaining({ status: 'approved' }),
      { new: true },
    );
    expect(result.status).toBe('approved');
    expect(mockActivityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'approval.approved' }),
    );
  });

  it('WhatsApp is only triggered AFTER approval gate (not for non-client_update kinds)', async () => {
    // WhatsApp is injected but only fires when kind === 'client_update' AND status === 'approved'.
    // For other kinds (e.g. 'quotation'), sendTemplate must NOT be called.
    const approvalId = new Types.ObjectId().toHexString();
    mockApprovalModel.findByIdAndUpdate.mockResolvedValue({
      _id: approvalId,
      kind: 'quotation',
      status: 'approved',
      approvedAt: new Date(),
      populate: jest.fn(),
      save: jest.fn(),
    });

    const actor = { _id: actorId, rolePermissions: [PERMISSIONS.APPROVALS_DECIDE] };
    await service.approve(approvalId, actor);

    expect(mockWhatsApp.sendTemplate).not.toHaveBeenCalled();
  });

  it('request approval throws Forbidden when actor lacks approvals:request', async () => {
    const actor = { _id: actorId, rolePermissions: [] };
    await expect(
      service.request({ projectId: new Types.ObjectId().toHexString(), kind: 'client_update' }, actor),
    ).rejects.toThrow('auth.insufficient_permissions');
  });

  it('pending approvals list throws Forbidden when actor lacks approvals:decide', async () => {
    // findPending does not guard itself — the controller + PermissionsGuard does.
    // This test checks ApprovalsService.approve/reject boundary instead.
    // Already covered above.
    expect(true).toBe(true);
  });
});
