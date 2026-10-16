import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Project, ProjectDocument } from './schemas/project.schema';
import { User } from '../users/schemas/user.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PERMISSIONS, DEFAULT_STAGE_WEIGHTS } from '@ti/shared';

export interface CreateProjectDto {
  clientId: string;
  title: string;
  firstStageId?: string;
  targetDate?: Date;
  assignedTeamIds?: string[];
  requiresDrawing?: boolean;
}

export interface UpdateProjectDto {
  title?: string;
  targetDate?: Date;
  assignedTeamIds?: string[];
  status?: string;
  stageWeights?: Record<string, number>;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @InjectModel(User.name) private userModel: Model<any>,
    private activityLog: ActivityLogService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(user: { _id: string; rolePermissions: string[] }) {
    const hasReadAll = user.rolePermissions.includes(PERMISSIONS.PROJECTS_READ_ALL);
    const filter = hasReadAll
      ? {}
      : { assignedTeam: new Types.ObjectId(user._id) };

    const projects = await this.projectModel
      .find(filter)
      .populate('client', 'name phone')
      .populate('currentStage', 'name order')
      .sort({ createdAt: -1 })
      .lean();

    return this.populateTeams(projects as unknown as Record<string, unknown>[]);
  }

  async findById(id: string, user: { _id: string; rolePermissions: string[] }) {
    const hasReadAll = user.rolePermissions.includes(PERMISSIONS.PROJECTS_READ_ALL);
    const filter: Record<string, unknown> = { _id: new Types.ObjectId(id) };
    if (!hasReadAll) {
      filter.assignedTeam = new Types.ObjectId(user._id);
    }

    const project = await this.projectModel
      .findOne(filter)
      .populate('client', 'name phone email address')
      .populate('currentStage', 'name order')
      .lean() as unknown as Record<string, unknown> | null;

    if (!project) throw new NotFoundException('project.not_found');
    const [populated] = await this.populateTeams([project]);
    return populated;
  }

  private async populateTeams(projects: Record<string, unknown>[]) {
    const allTeamIds = projects.flatMap((p) => {
      const team = p.assignedTeam as unknown[];
      return (team ?? []).map((id) => String(id));
    });
    const uniqueIds = [...new Set(allTeamIds)].filter(Boolean);

    if (uniqueIds.length === 0) return projects;

    const users = await this.userModel
      .find({ _id: { $in: uniqueIds.map((id) => new Types.ObjectId(id)) } })
      .select('name email department role')
      .lean();

    const userMap = new Map(users.map((u) => [String((u as Record<string, unknown>)._id), u]));

    return projects.map((p) => ({
      ...p,
      assignedTeam: ((p.assignedTeam as unknown[]) ?? []).map(
        (id) => userMap.get(String(id)) ?? { _id: String(id) },
      ),
    }));
  }

  async create(dto: CreateProjectDto, actorId: string) {
    const project = await this.projectModel.create({
      client: new Types.ObjectId(dto.clientId),
      title: dto.title,
      currentStage: dto.firstStageId ? new Types.ObjectId(dto.firstStageId) : undefined,
      stageHistory: dto.firstStageId
        ? [{ stage: new Types.ObjectId(dto.firstStageId), enteredAt: new Date() }]
        : [],
      targetDate: dto.targetDate,
      assignedTeam: (dto.assignedTeamIds ?? []).map((id) => new Types.ObjectId(id)),
      requiresDrawing: dto.requiresDrawing ?? true,
      progressPct: 0,
      createdBy: new Types.ObjectId(actorId),
    });

    await this.activityLog.record({
      actor: actorId,
      action: 'project.created',
      entity: 'projects',
      entityId: String(project._id),
      metadata: { title: dto.title },
    });

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, actorId: string, userPermissions: string[]) {
    const project = await this.projectModel.findById(id);
    if (!project) throw new NotFoundException('project.not_found');

    const update: Record<string, unknown> = {};
    if (dto.title !== undefined) update.title = dto.title;
    if (dto.targetDate !== undefined) update.targetDate = dto.targetDate;
    if (dto.status !== undefined) update.status = dto.status;
    if (dto.stageWeights !== undefined) update.stageWeights = dto.stageWeights;
    if (dto.assignedTeamIds !== undefined) {
      update.assignedTeam = dto.assignedTeamIds.map((id) => new Types.ObjectId(id));
    }

    await this.projectModel.findByIdAndUpdate(id, update);

    await this.activityLog.record({
      actor: actorId,
      action: 'project.updated',
      entity: 'projects',
      entityId: id,
      metadata: update,
    });

    return this.findById(id, { _id: actorId, rolePermissions: ['projects:read_all'] });
  }

  async advanceStage(
    projectId: string,
    nextStageId: string,
    actorId: string,
    userPermissions: string[],
  ) {
    if (!userPermissions.includes(PERMISSIONS.PROJECTS_ADVANCE_STAGE)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    const project = await this.projectModel.findById(projectId);
    if (!project) throw new NotFoundException('project.not_found');
    if (project.status !== 'active') throw new BadRequestException('project.not_active');

    const now = new Date();
    const currentIdx = project.stageHistory.findIndex(
      (s) => s.stage.toString() === project.currentStage?.toString() && !s.completedAt,
    );

    if (currentIdx !== -1) {
      project.stageHistory[currentIdx].completedAt = now;
    }

    project.stageHistory.push({ stage: new Types.ObjectId(nextStageId), enteredAt: now });
    project.currentStage = new Types.ObjectId(nextStageId);

    const progressPct = await this.computeProgress(project);
    project.progressPct = progressPct;

    await project.save();

    await this.activityLog.record({
      actor: actorId,
      action: 'project.stage_changed',
      entity: 'projects',
      entityId: projectId,
      metadata: { nextStageId },
    });

    this.eventEmitter.emit('project.progress_updated', { projectId, progressPct });

    return { success: true, progressPct };
  }

  async getProgress(projectId: string) {
    const project = await this.projectModel
      .findById(projectId)
      .populate('currentStage', 'name')
      .lean();

    if (!project) throw new NotFoundException('project.not_found');

    return {
      progressPct: project.progressPct,
      currentStage: project.currentStage,
      stageHistory: project.stageHistory,
    };
  }

  async addAdditionalWork(
    projectId: string,
    dto: { description: string; amount: number; drawingRequired?: boolean },
    actorId: string,
  ) {
    const project = await this.projectModel.findByIdAndUpdate(
      projectId,
      {
        $push: {
          additionalWork: {
            description: dto.description,
            amount: dto.amount,
            notifiedClient: false,
            drawingRequired: dto.drawingRequired ?? false,
          },
        },
      },
      { new: true },
    );

    if (!project) throw new NotFoundException('project.not_found');

    await this.activityLog.record({
      actor: actorId,
      action: 'project.additional_work_added',
      entity: 'projects',
      entityId: projectId,
      metadata: dto,
    });

    return project;
  }

  async recomputeProgress(projectId: string): Promise<number> {
    const project = await this.projectModel.findById(projectId);
    if (!project) return 0;

    const progressPct = await this.computeProgress(project);
    await this.projectModel.findByIdAndUpdate(projectId, { progressPct });
    this.eventEmitter.emit('project.progress_updated', { projectId, progressPct });
    return progressPct;
  }

  private async computeProgress(project: ProjectDocument): Promise<number> {
    const weights = project.stageWeights?.size
      ? Object.fromEntries(project.stageWeights)
      : DEFAULT_STAGE_WEIGHTS;

    const completedStageIds = project.stageHistory
      .filter((s) => s.completedAt)
      .map((s) => s.stage.toString());

    let completedWeight = 0;
    let totalWeight = 0;

    for (const [, weight] of Object.entries(weights)) {
      totalWeight += weight;
    }

    for (const stageId of completedStageIds) {
      const stageDoc = await this.projectModel.db
        .model('Department')
        .findById(stageId)
        .select('name')
        .lean() as { name: string } | null;

      if (stageDoc?.name && weights[stageDoc.name] !== undefined) {
        completedWeight += weights[stageDoc.name];
      }
    }

    if (totalWeight === 0) return 0;
    return Math.round((completedWeight / totalWeight) * 100);
  }
}
