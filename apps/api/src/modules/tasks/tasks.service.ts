import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Task, TaskDocument } from './schemas/task.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PERMISSIONS } from '@ti/shared';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private activityLog: ActivityLogService,
    private eventEmitter: EventEmitter2,
  ) {}

  findByProject(projectId: string, user: { _id: string; rolePermissions: string[] }) {
    const hasReadAll = user.rolePermissions.includes(PERMISSIONS.PROJECTS_READ_ALL);
    const filter: Record<string, unknown> = { project: new Types.ObjectId(projectId) };
    if (!hasReadAll) {
      filter.assignedTo = new Types.ObjectId(user._id);
    }
    return this.taskModel
      .find(filter)
      .populate('assignedTo', 'name email')
      .populate('department', 'name')
      .lean();
  }

  async create(
    projectId: string,
    dto: {
      title: string;
      description?: string;
      departmentId: string;
      assignedToId: string;
      dueDate?: Date;
      offlineCreatedAt?: Date;
    },
    actorId: string,
  ) {
    const task = await this.taskModel.create({
      project: new Types.ObjectId(projectId),
      department: new Types.ObjectId(dto.departmentId),
      title: dto.title,
      description: dto.description,
      assignedTo: new Types.ObjectId(dto.assignedToId),
      dueDate: dto.dueDate,
      offlineCreatedAt: dto.offlineCreatedAt,
      createdBy: new Types.ObjectId(actorId),
    });

    await this.activityLog.record({
      actor: actorId,
      action: 'task.created',
      entity: 'tasks',
      entityId: String(task._id),
    });

    this.eventEmitter.emit('task.created', { projectId, taskId: String(task._id) });

    return task;
  }

  async update(
    id: string,
    dto: { status?: string; assignedToId?: string; dueDate?: Date; photoId?: string },
    actor: { _id: string; rolePermissions: string[] },
  ) {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('task.not_found');

    const isAssigned = task.assignedTo.toString() === actor._id;
    const canEdit =
      actor.rolePermissions.includes(PERMISSIONS.TASKS_EDIT) ||
      (isAssigned && actor.rolePermissions.includes(PERMISSIONS.TASKS_EDIT));

    if (!canEdit) throw new ForbiddenException('auth.insufficient_permissions');

    const update: Record<string, unknown> = {};
    if (dto.status !== undefined) {
      update.status = dto.status;
      if (dto.status === 'done') update.completedAt = new Date();
    }
    if (dto.assignedToId !== undefined) update.assignedTo = new Types.ObjectId(dto.assignedToId);
    if (dto.dueDate !== undefined) update.dueDate = dto.dueDate;
    if (dto.photoId !== undefined) {
      await this.taskModel.findByIdAndUpdate(id, {
        $addToSet: { photos: new Types.ObjectId(dto.photoId) },
      });
    }

    const updated = await this.taskModel.findByIdAndUpdate(id, update, { new: true });

    await this.activityLog.record({
      actor: actor._id,
      action: 'task.updated',
      entity: 'tasks',
      entityId: id,
      metadata: update,
    });

    if (dto.status === 'done') {
      this.eventEmitter.emit('task.completed', {
        projectId: task.project.toString(),
        taskId: id,
      });
    }

    return updated;
  }

  async remove(id: string, actor: { _id: string; rolePermissions: string[] }) {
    if (!actor.rolePermissions.includes(PERMISSIONS.TASKS_DELETE)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }
    const task = await this.taskModel.findByIdAndDelete(id);
    if (!task) throw new NotFoundException('task.not_found');

    await this.activityLog.record({
      actor: actor._id,
      action: 'task.deleted',
      entity: 'tasks',
      entityId: id,
    });

    return { success: true };
  }
}
