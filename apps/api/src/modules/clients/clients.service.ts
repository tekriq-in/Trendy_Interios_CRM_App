import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Client, ClientDocument } from './schemas/client.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { TIDocument, DocumentDoc } from '../documents/schemas/document.schema';
import { Handover, HandoverDocument } from '../handovers/schemas/handover.schema';
import { Blocker, BlockerDocument } from '../blockers/schemas/blocker.schema';
import { Approval, ApprovalDocument } from '../approvals/schemas/approval.schema';
import { PurchaseItem, PurchaseItemDocument } from '../purchase-items/schemas/purchase-item.schema';
import { ShadeCardEntry, ShadeCardEntryDocument } from '../shade-card/schemas/shade-card.schema';
import { ChatGroup, ChatGroupDocument } from '../chat-groups/chat-group.schema';
import { Message, MessageDocument } from '../messages/messages.schema';
import { ClientMessage, ClientMessageDocument } from '../webhooks/client-message.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
export { CreateClientDto, UpdateClientDto };

@Injectable()
export class ClientsService {
  constructor(
    @InjectModel(Client.name) private clientModel: Model<ClientDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(TIDocument.name) private documentModel: Model<DocumentDoc>,
    @InjectModel(Handover.name) private handoverModel: Model<HandoverDocument>,
    @InjectModel(Blocker.name) private blockerModel: Model<BlockerDocument>,
    @InjectModel(Approval.name) private approvalModel: Model<ApprovalDocument>,
    @InjectModel(PurchaseItem.name) private purchaseItemModel: Model<PurchaseItemDocument>,
    @InjectModel(ShadeCardEntry.name) private shadeCardModel: Model<ShadeCardEntryDocument>,
    @InjectModel(ChatGroup.name) private chatGroupModel: Model<ChatGroupDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(ClientMessage.name) private clientMessageModel: Model<ClientMessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private activityLog: ActivityLogService,
  ) {}

  findAll(query: { search?: string; includeInactive?: boolean } = {}) {
    const filter: Record<string, unknown> = {};
    if (!query.includeInactive) filter.isActive = { $ne: false };
    if (query.search) {
      // Escape regex special chars to prevent ReDoS
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter['$or'] = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ];
    }
    return this.clientModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async deactivate(id: string, actorId: string) {
    const client = await this.clientModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!client) throw new NotFoundException('client.not_found');

    await this.activityLog.record({
      actor: actorId,
      action: 'client.deactivated',
      entity: 'clients',
      entityId: id,
    });

    return client;
  }

  async reactivate(id: string, actorId: string) {
    const client = await this.clientModel.findByIdAndUpdate(id, { isActive: true }, { new: true });
    if (!client) throw new NotFoundException('client.not_found');

    await this.activityLog.record({
      actor: actorId,
      action: 'client.reactivated',
      entity: 'clients',
      entityId: id,
    });

    return client;
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

  async deletePermanently(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('client.not_found');
    return this.permanentlyDeleteClients(new Types.ObjectId(id), true);
  }

  async deleteAllPermanently() {
    return this.permanentlyDeleteClients();
  }

  private async permanentlyDeleteClients(clientId?: Types.ObjectId, requireClient = false) {
    const db = this.clientModel.db.db;
    if (!db) throw new ServiceUnavailableException('database.unavailable');

    const hello = await db.admin().command({ hello: 1 });
    const supportsTransactions = Boolean(
      hello.setName || hello.msg === 'isdbgrid' || hello.serviceId,
    );
    const session = await this.clientModel.db.startSession();
    let deletedClients = 0;
    let deletedProjects = 0;

    const deleteClients = async (transactionSession?: ClientSession) => {
      const options = transactionSession ? { session: transactionSession } : {};
      const clientsQuery = this.clientModel.find(clientId ? { _id: clientId } : {});
      if (transactionSession) clientsQuery.session(transactionSession);
      const clients = await clientsQuery.select('_id').lean();
      const clientIds = clients.map((client) => client._id);
      deletedClients = clientIds.length;
      if (requireClient && clientIds.length === 0) throw new NotFoundException('client.not_found');
      if (clientIds.length === 0) return;

      const projectsQuery = this.projectModel.find({ client: { $in: clientIds } });
      if (transactionSession) projectsQuery.session(transactionSession);
      const projects = await projectsQuery.select('_id').lean();
      const projectIds = projects.map((project) => project._id);
      deletedProjects = projectIds.length;

      if (projectIds.length > 0) {
        const groupsQuery = this.chatGroupModel.find({ projectRef: { $in: projectIds } });
        if (transactionSession) groupsQuery.session(transactionSession);
        const projectGroups = await groupsQuery.select('channel').lean();
        const channels = [
          ...new Set([
            ...projectIds.map((projectId) => `project:${projectId.toString()}`),
            ...projectGroups.map((group) => group.channel),
          ]),
        ];

        await this.taskModel.deleteMany({ project: { $in: projectIds } }, options);
        await this.documentModel.deleteMany({ project: { $in: projectIds } }, options);
        await this.handoverModel.deleteMany({ project: { $in: projectIds } }, options);
        await this.blockerModel.deleteMany({ project: { $in: projectIds } }, options);
        await this.approvalModel.deleteMany({ project: { $in: projectIds } }, options);
        await this.purchaseItemModel.deleteMany({ project: { $in: projectIds } }, options);
        await this.shadeCardModel.deleteMany({ project: { $in: projectIds } }, options);
        await this.chatGroupModel.deleteMany({ projectRef: { $in: projectIds } }, options);
        await this.messageModel.deleteMany({ channel: { $in: channels } }, options);
        await this.userModel.updateMany(
          { assignedProjects: { $in: projectIds } },
          { $pull: { assignedProjects: { $in: projectIds } } },
          options,
        );
      }

      await this.clientMessageModel.deleteMany(
        {
          $or: [
            { client: { $in: clientIds } },
            ...(projectIds.length > 0 ? [{ project: { $in: projectIds } }] : []),
          ],
        },
        options,
      );
      await this.projectModel.deleteMany({ _id: { $in: projectIds } }, options);
      await this.clientModel.deleteMany({ _id: { $in: clientIds } }, options);
    };

    try {
      if (supportsTransactions) {
        await session.withTransaction(() => deleteClients(session));
      } else {
        await deleteClients();
      }
      return { success: true, deletedClients, deletedProjects };
    } finally {
      await session.endSession();
    }
  }
}
