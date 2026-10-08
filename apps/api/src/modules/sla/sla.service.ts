import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SlaSettings, SlaSettingsDocument } from './schemas/sla-settings.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PERMISSIONS } from '@ti/shared';

@Injectable()
export class SlaService {
  constructor(
    @InjectModel(SlaSettings.name) private slaModel: Model<SlaSettingsDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    private activityLog: ActivityLogService,
  ) {}

  findAll() {
    return this.slaModel.find().populate('department', 'name order').lean();
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
