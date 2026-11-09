import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApprovalsService } from '../src/modules/approvals/approvals.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';
import { MessageGeneratorService } from '../src/modules/message-generator/message-generator.service';
import { WHATSAPP_SERVICE } from '../src/modules/whatsapp/whatsapp.interface';
import { PERMISSIONS } from '@ti/shared';

const mockEventEmitter = { emit: jest.fn() };

const mockApprovalModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
};

const mockProjectModel = {
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  updateOne: jest.fn().mockResolvedValue({}),
};

const mockActivityLog = { record: jest.fn() };
const mockWhatsApp = { sendTemplate: jest.fn(), sendMessage: jest.fn() };
const mockMessageGenerator = { generate: jest.fn().mockResolvedValue('Mock generated message') };

describe('Approval Gate — no client message without approved approval', () => {
  let service: ApprovalsService;
  const actorId = new Types.ObjectId().toHexString();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: getModelToken('Approval'), useValue: mockApprovalModel },
        { provide: getModelToken('Project'), useValue: mockProjectModel },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: WHATSAPP_SERVICE, useValue: mockWhatsApp },
        { provide: MessageGeneratorService, useValue: mockMessageGenerator },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ApprovalsService>(ApprovalsService);
    jest.clearAllMocks();
  });

  it('throws ForbiddenException when actor lacks approvals:decide', async () => {
    const actor = { _id: actorId, rolePermissions: [PERMISSIONS.APPROVALS_REQUEST] };
    await expect(service.approve('someId', {}, actor)).rejects.toThrow(
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
    const result = await service.approve(approvalId, {}, actor);

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

  it('WhatsApp.sendMessage is NOT called for non-client_update kinds (quotation)', async () => {
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
    await service.approve(approvalId, {}, actor);

    expect(mockWhatsApp.sendMessage).not.toHaveBeenCalled();
    expect(mockWhatsApp.sendTemplate).not.toHaveBeenCalled();
  });

  it('WhatsApp.sendMessage IS called after approving a client_update with a phone number', async () => {
    const approvalId = new Types.ObjectId().toHexString();
    const savedApproval = {
      _id: approvalId,
      kind: 'client_update',
      status: 'approved',
      generatedMessage: 'Dear Rajesh, your project is progressing well. — Team Trendy Interios',
      whatsappScheduled: false,
      approvedAt: new Date(),
      save: jest.fn(),
      populate: jest.fn().mockImplementation(function () {
        this.project = {
          title: 'Sharma Residence',
          client: { phone: '+919876543210', name: 'Rajesh Sharma', whatsappOptIn: true },
        };
      }),
    };

    mockApprovalModel.findByIdAndUpdate.mockResolvedValue(savedApproval);

    const actor = { _id: actorId, rolePermissions: [PERMISSIONS.APPROVALS_DECIDE] };
    await service.approve(approvalId, {}, actor);

    // Service now uses sendTemplate (WhatsApp template API) for all approval kinds
    expect(mockWhatsApp.sendTemplate).toHaveBeenCalledWith(
      '+919876543210',
      'project_update',
      expect.arrayContaining([expect.stringContaining('Rajesh Sharma')]),
      expect.any(String),
    );
  });

  it('request approval throws Forbidden when actor lacks approvals:request', async () => {
    const actor = { _id: actorId, rolePermissions: [] };
    await expect(
      service.request({ projectId: new Types.ObjectId().toHexString(), kind: 'client_update' }, actor),
    ).rejects.toThrow('auth.insufficient_permissions');
  });

  it('request client_update without generatedMessage throws BadRequestException', async () => {
    const actor = { _id: actorId, rolePermissions: [PERMISSIONS.APPROVALS_REQUEST] };
    await expect(
      service.request(
        { projectId: new Types.ObjectId().toHexString(), kind: 'client_update', generatedMessage: '' },
        actor,
      ),
    ).rejects.toThrow('approval.client_update_requires_generated_message');
  });

  it('whatsapp:send_approved permission is never in the PERMISSIONS export', () => {
    const allSlugs = Object.values(PERMISSIONS);
    expect(allSlugs).not.toContain('whatsapp:send_approved');
  });
});
