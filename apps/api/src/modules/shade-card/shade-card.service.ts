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

  async reorder(projectId: string, orderedIds: string[]) {
    await Promise.all(
      orderedIds.map((id, idx) =>
        this.model.findByIdAndUpdate(id, { slNo: idx + 1 }),
      ),
    );
    return this.findByProject(projectId);
  }
}
