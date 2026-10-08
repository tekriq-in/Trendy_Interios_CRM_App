import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Blocker, BlockerDocument } from '../blockers/schemas/blocker.schema';
import { Approval, ApprovalDocument } from '../approvals/schemas/approval.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Blocker.name) private blockerModel: Model<BlockerDocument>,
    @InjectModel(Approval.name) private approvalModel: Model<ApprovalDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
  ) {}

  async getBoard() {
    const projects = await this.projectModel
      .find({ status: 'active' })
      .populate('client', 'name')
      .populate('currentStage', 'name order')
      .select('title client currentStage progressPct targetDate status')
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

  async getWorkload() {
    const tasks = await this.taskModel
      .aggregate([
        { $match: { status: { $in: ['pending', 'in_progress'] } } },
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
      .exec();

    return tasks;
  }

  async getBlockersSummary() {
    return this.blockerModel
      .find({ status: { $in: ['open', 'sla_triggered'] } })
      .populate('project', 'title')
      .populate('raisedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getStageDurations() {
    const results = await this.projectModel.aggregate([
      { $unwind: '$stageHistory' },
      { $match: { 'stageHistory.completedAt': { $exists: true, $ne: null } } },
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

  async getApprovalsPending() {
    const [list, count] = await Promise.all([
      this.approvalModel
        .find({ status: 'pending' })
        .populate('project', 'title')
        .populate('requestedBy', 'name')
        .sort({ createdAt: 1 })
        .limit(20)
        .lean(),
      this.approvalModel.countDocuments({ status: 'pending' }),
    ]);

    return { count, list };
  }
}
