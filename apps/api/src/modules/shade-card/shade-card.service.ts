import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ShadeCardEntry, ShadeCardEntryDocument } from './schemas/shade-card.schema';
import { CreateShadeCardEntryDto, UpdateShadeCardEntryDto } from './dto/shade-card.dto';
import { ShadeCardPdfService } from './shade-card-pdf.service';
import { DRIVE_SERVICE, IDriveService } from '../drive/drive.interface';
import { WHATSAPP_SERVICE, IWhatsAppService } from '../whatsapp/whatsapp.interface';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Approval, ApprovalDocument } from '../approvals/schemas/approval.schema';

@Injectable()
export class ShadeCardService implements OnModuleInit {
  private readonly logger = new Logger(ShadeCardService.name);

  constructor(
    @InjectModel(ShadeCardEntry.name) private model: Model<ShadeCardEntryDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Approval.name) private approvalModel: Model<ApprovalDocument>,
    private pdfService: ShadeCardPdfService,
    @Inject(DRIVE_SERVICE) private drive: IDriveService,
    @Inject(WHATSAPP_SERVICE) private whatsapp: IWhatsAppService,
  ) {}

  /**
   * One-time backfill for cards sent before revisions existed. Each earlier shade_card
   * approval counts as one send; an entry belongs to the first send made at/after its creation.
   */
  async onModuleInit() {
    try {
      const sends = (await this.approvalModel
        .find({ kind: 'shade_card' })
        .sort({ createdAt: 1 })
        .select('project createdAt')
        .lean()) as unknown as Array<{ project: Types.ObjectId; createdAt: Date }>;
      const byProject = new Map<string, Date[]>();
      for (const send of sends) {
        const key = String(send.project);
        byProject.set(key, [...(byProject.get(key) ?? []), new Date(send.createdAt)]);
      }

      for (const [projectId, dates] of byProject) {
        const project = await this.projectModel.findById(projectId).select('shadeCardRevision').lean();
        if (!project || (project.shadeCardRevision ?? 0) > 0) continue;

        const entries = (await this.model
          .find({ project: new Types.ObjectId(projectId), revision: { $exists: false } })
          .select('_id createdAt')
          .lean()) as unknown as Array<{ _id: Types.ObjectId; createdAt: Date }>;
        const ops = entries
          .map((e) => ({ id: e._id, rev: dates.findIndex((d) => d >= new Date(e.createdAt)) + 1 }))
          .filter((e) => e.rev > 0)
          .map((e) => ({ updateOne: { filter: { _id: e.id }, update: { $set: { revision: e.rev } } } }));
        if (ops.length) await this.model.bulkWrite(ops);
        await this.projectModel.updateOne({ _id: projectId }, { $set: { shadeCardRevision: dates.length } });
        this.logger.log(`Backfilled shade card revisions for project ${projectId} (R${dates.length})`);
      }
    } catch (err) {
      this.logger.error(`Shade card revision backfill failed: ${(err as Error).message}`);
    }
  }

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

  async sendApproval(projectId: string, actorId: string) {
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

    // One card per project: every send is a new revision. Entries not sent before go out in it.
    const revision = (project.shadeCardRevision ?? 0) + 1;
    const newEntries = entries.filter((e) => e.revision == null).length;

    // Generate PDF
    const pdfBuffer = await this.pdfService.generate(
      { title: project.title, clientName: client?.name, revision },
      entries.map((e) => ({
        slNo: e.slNo,
        area: e.area,
        units: e.units,
        material: e.material,
        codeName: e.codeName,
        remarks: e.remarks,
        revision: e.revision ?? revision,
      })),
    );

    // Upload to drive to get a public URL
    const fileName = `Material_Approval_Sheet_${project.title.replace(/\s+/g, '_')}_R${revision}_${Date.now()}.pdf`;
    const uploaded = await this.drive.uploadFile(pdfBuffer, fileName, 'application/pdf', 'shade-cards');

    // Send via WhatsApp if client has a phone number
    if (client?.phone) {
      const caption = `Dear ${client.name}, please find the Material Approval Sheet (Revision R${revision}) for your project "${project.title}". Kindly review and confirm your approval.`;
      await this.whatsapp.sendDocument(client.phone, uploaded.webViewLink, fileName, caption);
    }

    // Sent — stamp the revision on the new entries and on the project
    await this.model.updateMany(
      { project: new Types.ObjectId(projectId), revision: { $exists: false } },
      { $set: { revision } },
    );
    await this.projectModel.findByIdAndUpdate(projectId, {
      status: 'waiting_for_client_approval',
      shadeCardRevision: revision,
    });

    // Create a shade_card approval record so MD/GM can confirm in Approvals page
    await this.approvalModel.create({
      project: new Types.ObjectId(projectId),
      kind: 'shade_card',
      rawNotes: `Material Approval Sheet R${revision} (${newEntries} new ${newEntries === 1 ? 'entry' : 'entries'}) sent to ${client?.name ?? 'customer'} via WhatsApp PDF. Waiting for client confirmation.`,
      requestedBy: new Types.ObjectId(actorId),
      createdBy: new Types.ObjectId(actorId),
    });

    return { pdfUrl: uploaded.webViewLink, sentToPhone: client?.phone ?? null, revision, newEntries };
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
