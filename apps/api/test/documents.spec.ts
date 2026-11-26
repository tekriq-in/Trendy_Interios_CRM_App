import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { DocumentsService } from '../src/modules/documents/documents.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';
import { DRIVE_SERVICE } from '../src/modules/drive/drive.interface';

const mockDocumentModel = {
  find: jest.fn(),
};

const mockProjectModel = {
  findOne: jest.fn(),
};

describe('DocumentsService', () => {
  let service: DocumentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: getModelToken('TIDocument'), useValue: mockDocumentModel },
        { provide: getModelToken('Project'), useValue: mockProjectModel },
        { provide: DRIVE_SERVICE, useValue: {} },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    jest.clearAllMocks();
  });

  it('only reads documents for projects assigned to the employee', async () => {
    const projectId = new Types.ObjectId();
    const employeeId = new Types.ObjectId();
    mockProjectModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ _id: projectId }),
    });
    mockDocumentModel.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    await service.findByProject(String(projectId), {
      _id: String(employeeId),
      rolePermissions: [],
    });

    expect(mockProjectModel.findOne).toHaveBeenCalledWith({
      _id: projectId,
      assignedTeam: employeeId,
    });
    expect(mockDocumentModel.find).toHaveBeenCalledWith({
      project: projectId,
      isDeleted: { $ne: true },
    });
  });
});
