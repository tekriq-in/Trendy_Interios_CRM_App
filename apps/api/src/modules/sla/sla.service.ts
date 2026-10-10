import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model, Types } from 'mongoose';
import { SlaSettings, SlaSettingsDocument } from './schemas/sla-settings.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Blocker, BlockerDocument } from '../blockers/schemas/blocker.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PERMISSIONS } from '@ti/shared';

const SYSTEM_ACTOR = '000000000000000000000000';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    @InjectModel(SlaSettings.name) private slaModel: Model<SlaSettingsDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Blocker.name) private blockerModel: Model<BlockerDocument>,
    private activityLog: ActivityLogService,
    private eventEmitter: EventEmitter2,
  ) {}

  findAll() {
    return this.slaModel.find().populate('department', 'name order').lean();
  }

  @Cron('0 * * * *')
  async checkSlaBreaches() {
    try {
      const rows = await this.getReport();
      const breached = rows.filter((r) => r.breached);
      for (const row of breached) {
        const existing = await this.blockerModel.findOne({
          project: new Types.ObjectId(row.projectId),
          status: 'sla_triggered',
          title: { $regex: 'SLA breach', $options: 'i' },
        });
        if (existing) continue;

        const blocker = await this.blockerModel.create({
          project: new Types.ObjectId(row.projectId),
          raisedBy: new Types.ObjectId(SYSTEM_ACTOR),
          title: `SLA breach — ${row.stageName}`,
          description: `Project "${row.projectTitle}" has been in the ${row.stageName} stage for ${row.hoursInStage}h (limit: ${row.slaHours}h). Auto-created by SLA monitor.`,
          type: 'internal',
          status: 'sla_triggered',
          slaTriggeredAt: new Date(),
          createdBy: new Types.ObjectId(SYSTEM_ACTOR),
        });

        this.eventEmitter.emit('blocker.raised', {
          blockerId: String(blocker._id),
          projectId: row.projectId,
          title: blocker.title,
          type: 'internal',
          raisedBy: SYSTEM_ACTOR,
        });

        this.logger.warn(`SLA breach auto-blocker created for project ${row.projectTitle} (${row.stageName})`);
      }
    } catch (err) {
      this.logger.error(`SLA cron failed: ${(err as Error).message}`);
    }
  }

  async getReport() {
    const [slaSettings, projects] = await Promise.all([
      this.slaModel.find().populate('department', 'name order').lean(),
      this.projectModel
        .find({ status: 'active' })
        .populate('currentStage', 'name order')
        .lean(),
    ]);

    const slaByDeptId = new Map<string, number>();
    for (const s of slaSettings) {
      const deptId = String((s.department as unknown as { _id: Types.ObjectId })._id ?? s.department);
      slaByDeptId.set(deptId, s.defaultHours);
    }

    const now = Date.now();
    const rows = [];

    for (const project of projects) {
      if (!project.currentStage || !project.stageHistory?.length) continue;
      const currentEntry = project.stageHistory.slice().reverse().find((e) => !e.completedAt)
        ?? project.stageHistory[project.stageHistory.length - 1];
      if (!currentEntry?.enteredAt) continue;

      const stageId = String((project.currentStage as unknown as { _id: Types.ObjectId })._id ?? project.currentStage);
      const stageName = (project.currentStage as unknown as { name: string }).name ?? 'Unknown';
      const slaHours = slaByDeptId.get(stageId) ?? 48;
      const hoursInStage = (now - new Date(currentEntry.enteredAt).getTime()) / 3_600_000;

      rows.push({
        projectId: String(project._id),
        projectTitle: project.title,
        stageName,
        hoursInStage: Math.round(hoursInStage * 10) / 10,
        slaHours,
        breached: hoursInStage > slaHours,
        enteredAt: currentEntry.enteredAt,
      });
    }

    return rows.sort((a, b) => {
      if (a.breached !== b.breached) return a.breached ? -1 : 1;
      return b.hoursInStage - a.hoursInStage;
    });
  }

  async update(
    departmentId: string,
    defaultHours: number,
    actor: { _id: string; rolePermissions: string[] },
  ) {
    if (!actor.rolePermissions.includes(PERMISSIONS.SLA_EDIT)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    const sla = await this.slaModel.findOneAndUpdate(
      { department: new Types.ObjectId(departmentId) },
      {
        defaultHours,
        updatedBy: new Types.ObjectId(actor._id),
      },
      { new: true, upsert: true },
    );

    await this.activityLog.record({
      actor: actor._id,
      action: 'sla.updated',
      entity: 'slaSettings',
      entityId: String(sla._id),
      metadata: { departmentId, defaultHours },
    });

    return sla;
  }
}
