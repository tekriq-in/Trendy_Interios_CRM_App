import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ShadeCardEntry, ShadeCardEntryDocument } from './schemas/shade-card.schema';
import { CreateShadeCardEntryDto, UpdateShadeCardEntryDto } from './dto/shade-card.dto';

@Injectable()
export class ShadeCardService {
  constructor(
    @InjectModel(ShadeCardEntry.name) private model: Model<ShadeCardEntryDocument>,
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

  async reorder(projectId: string, orderedIds: string[]) {
    await Promise.all(
      orderedIds.map((id, idx) =>
        this.model.findByIdAndUpdate(id, { slNo: idx + 1 }),
      ),
    );
    return this.findByProject(projectId);
  }
}
