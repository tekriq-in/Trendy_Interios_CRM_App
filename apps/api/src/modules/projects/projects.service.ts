import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Project, ProjectDocument } from './schemas/project.schema';
import { User } from '../users/schemas/user.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ChatGroupsService } from '../chat-groups/chat-groups.service';
import { HandoversService } from '../handovers/handovers.service';
import { PERMISSIONS, DEFAULT_STAGE_WEIGHTS } from '@ti/shared';

import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
export { CreateProjectDto, UpdateProjectDto };

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @InjectModel(User.name) private userModel: Model<any>,
    private activityLog: ActivityLogService,
    private eventEmitter: EventEmitter2,
    private chatGroups: ChatGroupsService,
    private handoversService: HandoversService,
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

    const withProgress = await Promise.all(
      (projects as unknown as Array<Record<string, unknown>>).map(async (project) => ({
        ...project,
        progressPct: await this.computeProgress(project as unknown as ProgressInput),
      })),
    );
    return this.populateTeams(withProgress);
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
    const progressPct = await this.computeProgress(project as unknown as ProgressInput);
    return { ...populated, progressPct };
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

    // Auto-create project chat group
    await this.chatGroups.autoCreateForProject(
      String(project._id),
      dto.title,
      [actorId, ...(dto.assignedTeamIds ?? [])],
      actorId,
    ).catch(() => {});

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

    // When closing the project, mark the final open stage as completed so progress reaches 100%
    if (dto.status === 'completed') {
      const now = new Date();
      const openIdx = project.stageHistory.findIndex(
        (s) => s.stage.toString() === project.currentStage?.toString() && !s.completedAt,
      );
      if (openIdx !== -1) {
        project.stageHistory[openIdx].completedAt = now;
        await project.save();
      }
      const progressPct = await this.computeProgress(project);
      update.progressPct = progressPct;
      this.eventEmitter.emit('project.progress_updated', { projectId: id, progressPct });
    }

    await this.projectModel.findByIdAndUpdate(id, update);

    // Sync chat group members when team changes
    if (dto.assignedTeamIds !== undefined) {
      const proj = await this.projectModel.findById(id).lean() as unknown as { title: string };
      await this.chatGroups.autoCreateForProject(
        id,
        dto.title ?? proj?.title ?? '',
        [actorId, ...dto.assignedTeamIds],
        actorId,
      ).catch(() => {});
    }

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

    const nextDept = await this.projectModel.db
      .model('Department')
      .findById(nextStageId)
      .select('isActive')
      .lean() as { isActive?: boolean } | null;
    if (!nextDept) throw new NotFoundException('department.not_found');
    if (nextDept.isActive === false) throw new BadRequestException('department.deactivated');

    const now = new Date();
    const currentIdx = project.stageHistory.findIndex(
      (s) => s.stage.toString() === project.currentStage?.toString() && !s.completedAt,
    );

    if (currentIdx !== -1) {
      project.stageHistory[currentIdx].completedAt = now;
    }

    const fromStageId = project.currentStage?.toString();
    project.stageHistory.push({ stage: new Types.ObjectId(nextStageId), enteredAt: now });
    project.currentStage = new Types.ObjectId(nextStageId);

    const progressPct = await this.computeProgress(project);
    project.progressPct = progressPct;

    await project.save();

    // Auto-create a draft handover so it appears in the Handovers tab
    if (fromStageId) {
      await this.handoversService.createDraft({
        projectId,
        fromDepartmentId: fromStageId,
        toDepartmentId: nextStageId,
        raisedById: actorId,
      }).catch(() => {});
    }

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
      progressPct: await this.computeProgress(project as unknown as ProgressInput),
      currentStage: project.currentStage,
      stageHistory: project.stageHistory,
    };
  }

  async addAdditionalWork(
    projectId: string,
    dto: { description: string; amount: number; drawingRequired?: boolean },
    actor: { _id: string; rolePermissions: string[] },
  ) {
    await this.assertCanManageAdditionalWork(projectId, actor);
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
      actor: actor._id,
      action: 'project.additional_work_added',
      entity: 'projects',
      entityId: projectId,
      metadata: dto,
    });

    return project;
  }

  async updateAdditionalWork(
    projectId: string,
    workId: string,
    dto: { description: string; amount: number; drawingRequired?: boolean },
    actor: { _id: string; rolePermissions: string[] },
  ) {
    await this.assertCanManageAdditionalWork(projectId, actor);
    const project = await this.projectModel.findOneAndUpdate(
      { _id: projectId, 'additionalWork._id': new Types.ObjectId(workId) },
      {
        $set: {
          'additionalWork.$.description': dto.description,
          'additionalWork.$.amount': dto.amount,
          'additionalWork.$.drawingRequired': dto.drawingRequired ?? false,
        },
      },
      { new: true },
    );

    if (!project) throw new NotFoundException('additional_work.not_found');

    await this.activityLog.record({
      actor: actor._id,
      action: 'project.additional_work_updated',
      entity: 'projects',
      entityId: projectId,
      metadata: { workId, ...dto },
    });

    return project;
  }

  async deleteAdditionalWork(
    projectId: string,
    workId: string,
    actor: { _id: string; rolePermissions: string[] },
  ) {
    await this.assertCanManageAdditionalWork(projectId, actor);
    const project = await this.projectModel.findOneAndUpdate(
      { _id: projectId, 'additionalWork._id': new Types.ObjectId(workId) },
      { $pull: { additionalWork: { _id: new Types.ObjectId(workId) } } },
      { new: true },
    );

    if (!project) throw new NotFoundException('additional_work.not_found');

    await this.activityLog.record({
      actor: actor._id,
      action: 'project.additional_work_deleted',
      entity: 'projects',
      entityId: projectId,
      metadata: { workId },
    });

    return project;
  }

  private async assertCanManageAdditionalWork(
    projectId: string,
    actor: { _id: string; rolePermissions: string[] },
  ) {
    if (actor.rolePermissions.includes(PERMISSIONS.PROJECTS_EDIT)) return;

    const project = await this.projectModel
      .findOne({
        _id: new Types.ObjectId(projectId),
        assignedTeam: new Types.ObjectId(actor._id),
      })
      .select('_id')
      .lean();

    if (!project) throw new NotFoundException('project.not_found');
  }

  async recomputeProgress(projectId: string): Promise<number> {
    const project = await this.projectModel.findById(projectId);
    if (!project) return 0;

    const progressPct = await this.computeProgress(project);
    await this.projectModel.findByIdAndUpdate(projectId, { progressPct });
    this.eventEmitter.emit('project.progress_updated', { projectId, progressPct });
    return progressPct;
  }

  private async computeProgress(project: ProgressInput): Promise<number> {
    const configuredWeights = project.stageWeights instanceof Map
      ? Object.fromEntries(project.stageWeights)
      : project.stageWeights ?? {};
    const weights = Object.keys(configuredWeights).length
      ? configuredWeights
      : DEFAULT_STAGE_WEIGHTS;
    const completedIds = new Set(
      project.stageHistory
        .filter((stage) => Boolean(stage.completedAt))
        .map((stage) => String(stage.stage)),
    );
    const visitedIds = [...new Set(project.stageHistory.map((stage) => String(stage.stage)))];
    const departments = await this.projectModel.db
      .model('Department')
      .find({
        $or: [
          { isActive: { $ne: false } },
          { _id: { $in: visitedIds.map((stageId) => new Types.ObjectId(stageId)) } },
        ],
      })
      .select('name')
      .lean() as unknown as Array<{ _id: Types.ObjectId; name: string }>;

    const knownWeights = departments
      .map((department) => weights[department.name])
      .filter((weight): weight is number => Number.isFinite(weight) && weight > 0);
    const fallbackWeight = knownWeights.length
      ? knownWeights.reduce((sum, weight) => sum + weight, 0) / knownWeights.length
      : 1;
    const stageWeights = new Map(
      departments.map((department) => [
        String(department._id),
        Number.isFinite(weights[department.name]) && weights[department.name] > 0
          ? weights[department.name]
          : fallbackWeight,
      ]),
    );

    const totalWeight = [...stageWeights.values()].reduce((sum, weight) => sum + weight, 0);
    if (totalWeight === 0) return 0;

    const completedWeight = [...completedIds].reduce(
      (sum, stageId) => sum + (stageWeights.get(stageId) ?? 0),
      0,
    );
    return Math.max(0, Math.min(100, Math.round((completedWeight / totalWeight) * 100)));
  }
}

interface ProgressInput {
  stageHistory: Array<{ stage: Types.ObjectId | string; completedAt?: Date }>;
  stageWeights?: Map<string, number> | Record<string, number>;
}
