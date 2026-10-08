import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Client, ClientDocument } from './schemas/client.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';

export interface CreateClientDto {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  leadSource?: string;
  referredBy?: string;
  notes?: string;
  location?: { coordinates: [number, number] };
  whatsappOptIn?: boolean;
}

@Injectable()
export class ClientsService {
  constructor(
    @InjectModel(Client.name) private clientModel: Model<ClientDocument>,
    private activityLog: ActivityLogService,
  ) {}

  findAll(query: { search?: string } = {}) {
    const filter: Record<string, unknown> = {};
    if (query.search) {
      filter['$or'] = [
        { name: { $regex: query.search, $options: 'i' } },
        { phone: { $regex: query.search, $options: 'i' } },
      ];
    }
    return this.clientModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async findById(id: string) {
    const client = await this.clientModel.findById(id).lean();
    if (!client) throw new NotFoundException('client.not_found');
    return client;
  }

  async create(dto: CreateClientDto, actorId: string) {
    const client = await this.clientModel.create({
      ...dto,
      location: dto.location
        ? { type: 'Point', coordinates: dto.location.coordinates }
        : undefined,
      createdBy: new Types.ObjectId(actorId),
    });

    await this.activityLog.record({
      actor: actorId,
      action: 'client.created',
      entity: 'clients',
      entityId: String(client._id),
      metadata: { name: client.name },
    });

    return client;
  }

  async update(id: string, dto: Partial<CreateClientDto>, actorId: string) {
    const client = await this.clientModel.findByIdAndUpdate(id, dto, { new: true });
    if (!client) throw new NotFoundException('client.not_found');

    await this.activityLog.record({
      actor: actorId,
      action: 'client.updated',
      entity: 'clients',
      entityId: id,
    });

    return client;
  }
}
