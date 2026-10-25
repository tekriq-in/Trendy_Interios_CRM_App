import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Client, ClientDocument } from '../clients/schemas/client.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Approval, ApprovalDocument } from '../approvals/schemas/approval.schema';
import { ClientMessage, ClientMessageDocument } from './client-message.schema';

interface WaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface WaStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}

interface WaContact {
  profile: { name: string };
  wa_id: string;
}

interface WaWebhookPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WaMessage[];
        statuses?: WaStatus[];
        contacts?: WaContact[];
      };
    }>;
  }>;
}

const CONFIRM_WORDS = ['yes', 'ok', 'okay', 'confirm', 'proceed', 'approved', 'sure', 'agree', 'accept'];
const REJECT_WORDS  = ['no', 'cancel', 'reject', 'disagree', 'hold', 'wait', 'not yet'];

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectModel(Client.name)  private clientModel: Model<ClientDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Approval.name) private approvalModel: Model<ApprovalDocument>,
    @InjectModel(ClientMessage.name) private clientMessageModel: Model<ClientMessageDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findClientMessages() {
    return this.clientMessageModel
      .find()
      .populate('client', 'name phone')
      .populate('project', 'title')
      .populate('linkedApproval', 'kind generatedMessage')
      .sort({ receivedAt: -1 })
      .lean();
  }

  async markMessageRead(id: string): Promise<void> {
    await this.clientMessageModel.findByIdAndUpdate(id, { isRead: true });
  }

  async handleInbound(body: WaWebhookPayload): Promise<void> {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        // Phase D — delivery status updates
        for (const status of value.statuses ?? []) {
          await this.handleDeliveryStatus(status);
        }

        // Inbound messages
        for (const message of value.messages ?? []) {
          const contact = value.contacts?.find(c => c.wa_id === message.from);
          await this.processMessage(message, contact).catch(err =>
            this.logger.error(`Error processing inbound message: ${err.message}`)
          );
        }
      }
    }
  }

  private async handleDeliveryStatus(status: WaStatus): Promise<void> {
    if (!status.id) return;
    await this.approvalModel.updateOne(
      { whatsappMessageId: status.id },
      { whatsappDeliveryStatus: status.status },
    );
  }

  private async processMessage(message: WaMessage, contact?: WaContact): Promise<void> {
    if (message.type !== 'text' || !message.text?.body) return;

    const rawPhone = message.from; // Meta sends digits only, e.g. "919876543210"
    const last10 = rawPhone.replace(/\D/g, '').slice(-10);

    // Find client whose stored phone ends with these 10 digits
    const client = await this.clientModel.findOne({
      phone: { $regex: new RegExp(last10 + '$') },
      isActive: true,
    }).lean();

    if (!client) {
      this.logger.warn(`Inbound WA from unknown number: ${rawPhone}`);
      return;
    }

    const body = message.text.body.trim();
    const bodyLower = body.toLowerCase();

    // STOP opt-out — honour immediately
    if (bodyLower === 'stop') {
      await this.clientModel.findByIdAndUpdate(client._id, { whatsappOptIn: false });
      this.logger.log(`Client ${client._id} opted out via STOP`);
      return;
    }

    // Find most recent relevant approval for client's projects
    const projects = await this.projectModel
      .find({ client: client._id })
      .select('_id title')
      .sort({ createdAt: -1 })
      .lean();

    const projectIds = projects.map(p => p._id);

    const approval = projectIds.length
      ? await this.approvalModel
          .findOne({ project: { $in: projectIds }, status: { $in: ['pending', 'approved'] } })
          .sort({ createdAt: -1 })
          .lean()
      : null;

    const isConfirmation = CONFIRM_WORDS.some(w => bodyLower.includes(w));
    const isRejection    = !isConfirmation && REJECT_WORDS.some(w => bodyLower.includes(w));

    if (approval && isConfirmation) {
      await this.approvalModel.findByIdAndUpdate(approval._id, {
        customerConfirmed: true,
        customerConfirmedAt: new Date(),
        customerReplyText: body,
      });
    }

    if (!isConfirmation) {
      // Store free-form or rejection as a ClientMessage for MD/GM inbox
      await this.clientMessageModel.create({
        client: client._id,
        project: projects[0]?._id,
        linkedApproval: approval?._id,
        body,
        receivedAt: new Date(parseInt(message.timestamp, 10) * 1000),
      });
    }

    const clientName = contact?.profile?.name ?? client.name;
    this.eventEmitter.emit('client.replied', {
      clientId: String(client._id),
      clientName,
      projectId: projects[0] ? String(projects[0]._id) : null,
      approvalId: approval ? String(approval._id) : null,
      body,
      isConfirmation,
      isRejection,
    });
  }
}
