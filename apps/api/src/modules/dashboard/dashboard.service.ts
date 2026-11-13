import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Blocker, BlockerDocument } from '../blockers/schemas/blocker.schema';
import { Approval, ApprovalDocument } from '../approvals/schemas/approval.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { PurchaseItem, PurchaseItemDocument } from '../purchase-items/schemas/purchase-item.schema';
import { Handover, HandoverDocument } from '../handovers/schemas/handover.schema';

type ActivityPeriod = { from?: string; to?: string };

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Blocker.name) private blockerModel: Model<BlockerDocument>,
    @InjectModel(Approval.name) private approvalModel: Model<ApprovalDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PurchaseItem.name) private purchaseItemModel: Model<PurchaseItemDocument>,
    @InjectModel(Handover.name) private handoverModel: Model<HandoverDocument>,
  ) {}

  private getActivityRange(period: ActivityPeriod) {
    if (!period.from && !period.to) return null;

    const parseDate = (value: string | undefined, field: string) => {
      if (!value) return undefined;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new BadRequestException(`dashboard.invalid_${field}_date`);
      }
      const date = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new BadRequestException(`dashboard.invalid_${field}_date`);
      }
      return date;
    };

    const from = parseDate(period.from, 'from');
    const to = parseDate(period.to, 'to');
    if (from && to && from > to) {
      throw new BadRequestException('dashboard.invalid_date_range');
    }

    const range: Record<string, Date> = {};
    if (from) range.$gte = from;
    if (to) {
      const endExclusive = new Date(to);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      range.$lt = endExclusive;
    }
    return range;
  }

  private async getProjectsWithActivity(period: ActivityPeriod): Promise<string[] | null> {
    const dateRange = this.getActivityRange(period);
    if (!dateRange) return null;

    const dateMatch = (fields: string[]) => ({
      $or: fields.map((field) => ({ [field]: dateRange })),
    });

    const [projects, tasks, approvals, blockers, purchaseItems, handovers] = await Promise.all([
      this.projectModel
        .find({
          $or: [
            { createdAt: dateRange },
            { updatedAt: dateRange },
            { 'stageHistory.enteredAt': dateRange },
            { 'stageHistory.completedAt': dateRange },
          ],
        })
        .select('_id')
        .lean(),
      this.taskModel.find(dateMatch(['createdAt', 'updatedAt', 'completedAt'])).select('project').lean(),
      this.approvalModel.find(dateMatch(['createdAt', 'updatedAt', 'approvedAt', 'customerConfirmedAt'])).select('project').lean(),
      this.blockerModel.find(dateMatch(['createdAt', 'updatedAt', 'slaTriggeredAt', 'resolvedAt'])).select('project').lean(),
      this.purchaseItemModel.find(dateMatch(['createdAt', 'updatedAt', 'orderedAt', 'receivedAt'])).select('project').lean(),
      this.handoverModel.find(dateMatch(['createdAt', 'updatedAt'])).select('project').lean(),
    ]);

    return [...new Set([
      ...projects.map((project) => String(project._id)),
      ...tasks.map((item) => String(item.project)),
      ...approvals.map((item) => String(item.project)),
      ...blockers.map((item) => String(item.project)),
      ...purchaseItems.map((item) => String(item.project)),
      ...handovers.map((item) => String(item.project)),
    ])];
  }

  async getBoard(period: ActivityPeriod = {}) {
    const projectIds = await this.getProjectsWithActivity(period);
    const filter: Record<string, unknown> = { status: 'active' };
    if (projectIds) filter._id = { $in: projectIds };

    const projects = await this.projectModel
      .find(filter)
      .populate('client', 'name')
      .populate('currentStage', 'name order')
      .select('title client currentStage progressPct targetDate status createdAt updatedAt stageHistory')
      .lean();

    const grouped: Record<string, typeof projects> = {};
    for (const p of projects) {
      const stageName =
        (p.currentStage as unknown as { name: string } | null)?.name ?? 'Unassigned';
      if (!grouped[stageName]) grouped[stageName] = [];
      grouped[stageName].push(p);
    }

    return grouped;
  }

  async getWorkload(period: ActivityPeriod = {}) {
    const projectIds = await this.getProjectsWithActivity(period);
    const [tasks, employees] = await Promise.all([
      this.taskModel
      .aggregate([
        {
          $match: {
            status: { $in: ['pending', 'in_progress'] },
            ...(projectIds
              ? { project: { $in: projectIds.map((projectId) => new Types.ObjectId(projectId)) } }
              : {}),
          },
        },
        {
          $group: {
            _id: '$assignedTo',
            totalTasks: { $sum: 1 },
            inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            userId: '$_id',
            userName: '$user.name',
            totalTasks: 1,
            inProgress: 1,
          },
        },
        { $sort: { totalTasks: -1 } },
      ])
      .exec(),
      this.userModel.find({ isActive: true }).select('_id name').lean(),
    ]);

    const workloadByUser = new Map(
      tasks.map((task: { userId: unknown; totalTasks: number; inProgress: number }) => [
        String(task.userId),
        task,
      ]),
    );

    return employees
      .map((employee) => {
        const workload = workloadByUser.get(String(employee._id));
        return {
          userId: String(employee._id),
          userName: employee.name,
          totalTasks: workload?.totalTasks ?? 0,
          inProgress: workload?.inProgress ?? 0,
        };
      })
      .sort((a, b) => b.totalTasks - a.totalTasks || a.userName.localeCompare(b.userName));
  }

  async getBlockersSummary(period: ActivityPeriod = {}) {
    const projectIds = await this.getProjectsWithActivity(period);
    const filter: Record<string, unknown> = { status: { $in: ['open', 'sla_triggered'] } };
    if (projectIds) filter.project = { $in: projectIds };

    return this.blockerModel
      .find(filter)
      .populate('project', 'title')
      .populate('raisedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getStageDurations(period: ActivityPeriod = {}) {
    const dateRange = this.getActivityRange(period);
    const results = await this.projectModel.aggregate([
      { $unwind: '$stageHistory' },
      { $match: { 'stageHistory.completedAt': { $exists: true, $ne: null } } },
      ...(dateRange ? [{ $match: { 'stageHistory.completedAt': dateRange } }] : []),
      {
        $addFields: {
          durationHours: {
            $divide: [
              { $subtract: ['$stageHistory.completedAt', '$stageHistory.enteredAt'] },
              3_600_000,
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'departments',
          localField: 'stageHistory.stage',
          foreignField: '_id',
          as: 'dept',
        },
      },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { stageId: '$stageHistory.stage', stageName: '$dept.name', order: '$dept.order' },
          avgHours: { $avg: '$durationHours' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          stageName: '$_id.stageName',
          order: '$_id.order',
          avgHours: { $round: ['$avgHours', 1] },
          count: 1,
        },
      },
      { $sort: { order: 1 } },
    ]);

    return results;
  }

  async getApprovalsPending(period: ActivityPeriod = {}) {
    const projectIds = await this.getProjectsWithActivity(period);
    const filter: Record<string, unknown> = { status: 'pending' };
    if (projectIds) filter.project = { $in: projectIds };

    const [list, count] = await Promise.all([
      this.approvalModel
        .find(filter)
        .populate('project', 'title')
        .populate('requestedBy', 'name')
        .sort({ createdAt: 1 })
        .limit(20)
        .lean(),
      this.approvalModel.countDocuments(filter),
    ]);

    return { count, list };
  }
}
