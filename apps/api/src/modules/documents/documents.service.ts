import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TIDocument, DocumentDoc } from './schemas/document.schema';
import { DRIVE_SERVICE, IDriveService } from '../drive/drive.interface';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(TIDocument.name) private docModel: Model<DocumentDoc>,
    @Inject(DRIVE_SERVICE) private driveService: IDriveService,
    private activityLog: ActivityLogService,
  ) {}

  async upload(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    meta: {
      projectId?: string;
      departmentId?: string;
      type?: string;
      folderPath?: string;
    },
    actorId: string,
  ) {
    const folderPath = meta.folderPath ?? `projects/${meta.projectId ?? 'general'}`;
    const result = await this.driveService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      folderPath,
    );

    const doc = await this.docModel.create({
      project: meta.projectId ? new Types.ObjectId(meta.projectId) : undefined,
      department: meta.departmentId ? new Types.ObjectId(meta.departmentId) : undefined,
      driveFileId: result.fileId,
      driveLink: result.webViewLink,
      mimeType: result.mimeType,
      fileName: result.fileName,
      fileSize: result.fileSize,
      type: meta.type ?? 'other',
      uploadedBy: new Types.ObjectId(actorId),
      createdBy: new Types.ObjectId(actorId),
    });

    await this.activityLog.record({
      actor: actorId,
      action: 'document.uploaded',
      entity: 'documents',
      entityId: String(doc._id),
      metadata: { fileName: file.originalname, type: meta.type },
    });

    return doc;
  }

  async findById(id: string) {
    const doc = await this.docModel.findOne({ _id: id, isDeleted: false }).lean();
    if (!doc) throw new NotFoundException('document.not_found');
    return doc;
  }

  async softDelete(id: string, actorId: string) {
    const doc = await this.docModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    if (!doc) throw new NotFoundException('document.not_found');

    await this.activityLog.record({
      actor: actorId,
      action: 'document.deleted',
      entity: 'documents',
      entityId: id,
    });

    return { success: true };
  }
}
