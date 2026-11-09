import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ShadeCardEntry, ShadeCardEntryDocument } from './schemas/shade-card.schema';
import { CreateShadeCardEntryDto, UpdateShadeCardEntryDto } from './dto/shade-card.dto';
import { ShadeCardPdfService } from './shade-card-pdf.service';
import { DRIVE_SERVICE, IDriveService } from '../drive/drive.interface';
import { WHATSAPP_SERVICE, IWhatsAppService } from '../whatsapp/whatsapp.interface';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Client } from '../clients/schemas/client.schema';

@Injectable()
export class ShadeCardService {
  constructor(
    @InjectModel(ShadeCardEntry.name) private model: Model<ShadeCardEntryDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    private pdfService: ShadeCardPdfService,
    @Inject(DRIVE_SERVICE) private drive: IDriveService,
    @Inject(WHATSAPP_SERVICE) private whatsapp: IWhatsAppService,
  ) {}

  async findByProject(projectId: string) {
    return this.model
      .find({ project: new Types.ObjectId(projectId) })
      .sort({ slNo: 1, createdAt: 1 })
      .lean();
  }

  async create(projectId: string, dto: CreateShadeCardEntryDto, actorId: string) {
    // Auto-assign slNo as next available if not provided
    if (dto.slNo == null) {
      const count = await this.model.countDocuments({ project: new Types.ObjectId(projectId) });
      dto.slNo = count + 1;
    }
    const entry = new this.model({
      ...dto,
      project: new Types.ObjectId(projectId),
      createdBy: new Types.ObjectId(actorId),
    });
    return entry.save();
  }

  async update(id: string, dto: UpdateShadeCardEntryDto, actorId: string) {
    const entry = await this.model.findByIdAndUpdate(
      id,
      { ...dto, updatedBy: new Types.ObjectId(actorId) },
      { new: true },
    );
    if (!entry) throw new NotFoundException('shade_card.not_found');
    return entry;
  }

  async remove(id: string) {
    const entry = await this.model.findByIdAndDelete(id);
    if (!entry) throw new NotFoundException('shade_card.not_found');
    return { deleted: true };
  }

  async suggestions(q: string, field: 'codeName' | 'area' | 'units') {
    const regex = new RegExp(q, 'i');
    if (field === 'codeName') {
      // Return value + photoUrl so the UI can pre-fill the swatch photo
      const results = await this.model.aggregate([
        { $match: { codeName: regex } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$codeName', photoUrl: { $first: '$photoUrl' } } },
        { $sort: { _id: 1 } },
        { $limit: 10 },
      ]);
      return results.map((r: { _id: string; photoUrl?: string }) => ({
        value: r._id,
        photoUrl: r.photoUrl ?? null,
      }));
    }
    if (field === 'units') {
      const results = await this.model.aggregate([
        { $unwind: '$units' },
        { $match: { units: regex } },
        { $group: { _id: '$units' } },
        { $sort: { _id: 1 } },
        { $limit: 10 },
      ]);
      return results.map((r: { _id: string }) => ({ value: r._id, photoUrl: null }));
    }
    // area — simple distinct
    const values: string[] = await this.model.distinct(field, { [field]: regex });
    return values.slice(0, 10).map((v) => ({ value: v, photoUrl: null }));
  }

  async sendApproval(projectId: string) {
    const entries = await this.findByProject(projectId);
    if (entries.length === 0) {
      throw new BadRequestException('shade_card.no_entries');
    }

    const project = await this.projectModel
      .findById(projectId)
      .populate<{ client: { name: string; phone?: string } }>('client', 'name phone')
      .lean();
    if (!project) throw new NotFoundException('project.not_found');

    const client = project.client as unknown as { name: string; phone?: string };

    // Generate PDF
    const pdfBuffer = await this.pdfService.generate(
      { title: project.title, clientName: client?.name },
      entries.map((e) => ({
        slNo: e.slNo,
        area: e.area,
        units: e.units,
        material: e.material,
        codeName: e.codeName,
        remarks: e.remarks,
      })),
    );

    // Upload to drive to get a public URL
    const fileName = `Material_Approval_Sheet_${project.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    const uploaded = await this.drive.uploadFile(pdfBuffer, fileName, 'application/pdf', 'shade-cards');

    // Send via WhatsApp if client has a phone number
    if (client?.phone) {
      const caption = `Dear ${client.name}, please find the Material Approval Sheet for your project "${project.title}". Kindly review and confirm your approval.`;
      await this.whatsapp.sendDocument(client.phone, uploaded.webViewLink, fileName, caption);
    }

    // Set project status to waiting_for_client_approval
    await this.projectModel.findByIdAndUpdate(projectId, { status: 'waiting_for_client_approval' });

    return { pdfUrl: uploaded.webViewLink, sentToPhone: client?.phone ?? null };
  }

  async reorder(projectId: string, orderedIds: string[]) {
    await Promise.all(
      orderedIds.map((id, idx) =>
        this.model.findByIdAndUpdate(id, { slNo: idx + 1 }),
      ),
    );
    return this.findByProject(projectId);
  }
}
