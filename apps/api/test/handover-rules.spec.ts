import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HandoversService } from '../src/modules/handovers/handovers.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';
import { PERMISSIONS } from '@ti/shared';

const mockHandoverModel = {
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
};

const mockActivityLog = { record: jest.fn() };
const mockEventEmitter = { emit: jest.fn() };

describe('Handover Rules', () => {
  let service: HandoversService;
  const actorId = new Types.ObjectId().toHexString();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandoversService,
        { provide: getModelToken('Handover'), useValue: mockHandoverModel },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<HandoversService>(HandoversService);
    jest.clearAllMocks();
  });

  it('throws BadRequestException when proofFileIds is empty', async () => {
    const actor = {
      _id: actorId,
      rolePermissions: [PERMISSIONS.HANDOVERS_RAISE],
    };

    await expect(
      service.raise(
        {
          projectId: new Types.ObjectId().toHexString(),
          fromDepartmentId: new Types.ObjectId().toHexString(),
          toDepartmentId: new Types.ObjectId().toHexString(),
          proofFileIds: [],
        },
        actor,
      ),
    ).rejects.toThrow('handover.proof_required');
  });

  it('throws BadRequestException when proofFileIds is missing', async () => {
    const actor = {
      _id: actorId,
      rolePermissions: [PERMISSIONS.HANDOVERS_RAISE],
    };

    await expect(
      service.raise(
        {
          projectId: new Types.ObjectId().toHexString(),
          fromDepartmentId: new Types.ObjectId().toHexString(),
          toDepartmentId: new Types.ObjectId().toHexString(),
          proofFileIds: undefined as unknown as string[],
        },
        actor,
      ),
    ).rejects.toThrow('handover.proof_required');
  });

  it('creates handover successfully with proof files', async () => {
    const proofFileId = new Types.ObjectId().toHexString();
    const projectId = new Types.ObjectId().toHexString();
    const fromDeptId = new Types.ObjectId().toHexString();
    const toDeptId = new Types.ObjectId().toHexString();

    const createdHandover = {
      _id: new Types.ObjectId(),
      status: 'draft',
      proofFiles: [new Types.ObjectId(proofFileId)],
    };

    mockHandoverModel.create.mockResolvedValue(createdHandover);

    const actor = {
      _id: actorId,
      rolePermissions: [PERMISSIONS.HANDOVERS_RAISE],
    };

    const result = await service.raise(
      { projectId, fromDepartmentId: fromDeptId, toDepartmentId: toDeptId, proofFileIds: [proofFileId] },
      actor,
    );

    expect(mockHandoverModel.create).toHaveBeenCalled();
    expect(result.status).toBe('draft');
  });

  it('throws ForbiddenException when actor lacks handovers:raise', async () => {
    const actor = { _id: actorId, rolePermissions: [] };

    await expect(
      service.raise(
        {
          projectId: new Types.ObjectId().toHexString(),
          fromDepartmentId: new Types.ObjectId().toHexString(),
          toDepartmentId: new Types.ObjectId().toHexString(),
          proofFileIds: [new Types.ObjectId().toHexString()],
        },
        actor,
      ),
    ).rejects.toThrow('auth.insufficient_permissions');
  });

  it('throws BadRequestException when confirming non-draft handover', async () => {
    const handoverId = new Types.ObjectId().toHexString();
    mockHandoverModel.findById.mockResolvedValue({
      _id: handoverId,
      status: 'confirmed',
      save: jest.fn(),
    });

    const actor = { _id: actorId, rolePermissions: [PERMISSIONS.HANDOVERS_CONFIRM_FROM] };
    await expect(service.confirm(handoverId, actor)).rejects.toThrow(
      'handover.invalid_transition',
    );
  });

  it('throws BadRequestException when rejecting without a reason', async () => {
    const handoverId = new Types.ObjectId().toHexString();
    mockHandoverModel.findById.mockResolvedValue({
      _id: handoverId,
      status: 'confirmed',
      save: jest.fn(),
    });

    const actor = { _id: actorId, rolePermissions: [PERMISSIONS.HANDOVERS_ACCEPT_TO] };
    await expect(service.reject(handoverId, '', actor)).rejects.toThrow(
      'handover.reason_required',
    );
  });
});
