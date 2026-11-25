import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';
import { PERMISSIONS } from '@ti/shared';
import { ProjectAccessService } from '../src/common/access/project-access.service';
import { TasksService } from '../src/modules/tasks/tasks.service';
import { HandoversService } from '../src/modules/handovers/handovers.service';
import { BlockersService } from '../src/modules/blockers/blockers.service';
import { ChatGroupsService } from '../src/modules/chat-groups/chat-groups.service';
import { MessagesGateway } from '../src/modules/messages/messages.gateway';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';
import { escapeRegExp } from '../src/common/utils/escape-regex';

/**
 * SOW rule: employees only see and act on projects they are assigned to.
 * These tests pin the endpoints that used to skip that check (tasks, handovers,
 * blockers) and the chat channels, so the gap cannot quietly come back.
 */

const id = () => new Types.ObjectId();
const employee = { _id: id().toHexString(), rolePermissions: [] as string[] };
const projectId = id().toHexString();

/** Access check that refuses, exactly as ProjectAccessService does for an unassigned project. */
const deny = () => ({
  assertAccess: jest.fn().mockRejectedValue(new NotFoundException('project.not_found')),
  visibleProjectIds: jest.fn().mockResolvedValue([]),
  hasReadAll: jest.fn().mockReturnValue(false),
});
const allow = () => ({
  assertAccess: jest.fn().mockResolvedValue(undefined),
  visibleProjectIds: jest.fn().mockResolvedValue(null),
  hasReadAll: jest.fn().mockReturnValue(true),
});

// ───────────────────────── ProjectAccessService ─────────────────────────

describe('ProjectAccessService', () => {
  const projectModel = { exists: jest.fn(), find: jest.fn() };
  let service: ProjectAccessService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [ProjectAccessService, { provide: getModelToken('Project'), useValue: projectModel }],
    }).compile();
    service = mod.get(ProjectAccessService);
  });

  it('limits an employee to projects they are assigned to', async () => {
    projectModel.exists.mockResolvedValue({ _id: id() });
    await service.assertAccess(projectId, employee);
    expect(projectModel.exists).toHaveBeenCalledWith({
      _id: new Types.ObjectId(projectId),
      assignedTeam: new Types.ObjectId(employee._id),
    });
  });

  it('lets roles with projects:read_all see any existing project', async () => {
    projectModel.exists.mockResolvedValue({ _id: id() });
    await service.assertAccess(projectId, { _id: employee._id, rolePermissions: [PERMISSIONS.PROJECTS_READ_ALL] });
    expect(projectModel.exists).toHaveBeenCalledWith({ _id: new Types.ObjectId(projectId) });
  });

  it('answers 404 (not 403) for a project the user is not on, so existence is not leaked', async () => {
    projectModel.exists.mockResolvedValue(null);
    await expect(service.assertAccess(projectId, employee)).rejects.toThrow(NotFoundException);
  });

  it('rejects malformed ids without querying', async () => {
    await expect(service.assertAccess('not-an-id', employee)).rejects.toThrow('project.not_found');
    expect(projectModel.exists).not.toHaveBeenCalled();
  });

  it('visibleProjectIds is null for read-all roles and the assigned ids otherwise', async () => {
    expect(await service.visibleProjectIds({ _id: employee._id, rolePermissions: [PERMISSIONS.PROJECTS_READ_ALL] })).toBeNull();
    const mine = id();
    projectModel.find.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{ _id: mine }]) });
    expect(await service.visibleProjectIds(employee)).toEqual([mine]);
    expect(projectModel.find).toHaveBeenCalledWith({ assignedTeam: new Types.ObjectId(employee._id) });
  });
});

// ───────────────────────────── Tasks ─────────────────────────────

describe('TasksService project isolation', () => {
  const taskModel = {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    create: jest.fn(),
  };
  const build = async (access: ReturnType<typeof allow>) => {
    const mod = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getModelToken('Task'), useValue: taskModel },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: ProjectAccessService, useValue: access },
      ],
    }).compile();
    return mod.get(TasksService);
  };
  const editor = { _id: employee._id, rolePermissions: [PERMISSIONS.TASKS_EDIT, PERMISSIONS.TASKS_CREATE, PERMISSIONS.TASKS_DELETE] };

  beforeEach(() => jest.clearAllMocks());

  it('refuses to update a task in a project the user is not assigned to', async () => {
    taskModel.findById.mockResolvedValue({ _id: id(), project: id(), assignedTo: id() });
    const service = await build(deny());
    await expect(service.update(id().toHexString(), { status: 'done' }, editor)).rejects.toThrow('project.not_found');
    expect(taskModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('updates a task when the user can see its project', async () => {
    taskModel.findById.mockResolvedValue({ _id: id(), project: id(), assignedTo: id() });
    taskModel.findByIdAndUpdate.mockResolvedValue({ _id: id() });
    const service = await build(allow());
    await service.update(id().toHexString(), { status: 'in_progress' }, editor);
    expect(taskModel.findByIdAndUpdate).toHaveBeenCalled();
  });

  it('refuses to delete a task in another project', async () => {
    taskModel.findById.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue({ project: id() }) });
    const service = await build(deny());
    await expect(service.remove(id().toHexString(), editor)).rejects.toThrow('project.not_found');
    expect(taskModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('refuses to create a task in a project the user is not on', async () => {
    const service = await build(deny());
    await expect(
      service.create(projectId, { title: 'x', departmentId: id().toHexString(), assignedToId: employee._id }, editor),
    ).rejects.toThrow('project.not_found');
    expect(taskModel.create).not.toHaveBeenCalled();
  });

  it('refuses to list the tasks of a project the user is not on', async () => {
    const service = await build(deny());
    await expect(service.findByProject(projectId, employee)).rejects.toThrow('project.not_found');
    expect(taskModel.find).not.toHaveBeenCalled();
  });
});

// ──────────────────────────── Handovers ────────────────────────────

describe('HandoversService project isolation', () => {
  const handoverModel = { aggregate: jest.fn().mockResolvedValue([]), findById: jest.fn(), create: jest.fn() };
  const build = async (access: ReturnType<typeof allow>) => {
    const mod = await Test.createTestingModule({
      providers: [
        HandoversService,
        { provide: getModelToken('Handover'), useValue: handoverModel },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: ProjectAccessService, useValue: access },
      ],
    }).compile();
    return mod.get(HandoversService);
  };
  const lead = {
    _id: employee._id,
    rolePermissions: [PERMISSIONS.HANDOVERS_RAISE, PERMISSIONS.HANDOVERS_CONFIRM_FROM, PERMISSIONS.HANDOVERS_ACCEPT_TO],
  };
  const pending = (status: string, from = id(), to = id()) => ({ project: id(), status, fromDepartment: from, toDepartment: to, save: jest.fn() });
  const sendingDept = id();
  const receivingDept = id();
  const otherDept = id();
  const leadOf = (dept: Types.ObjectId) => ({ ...lead, department: dept });

  beforeEach(() => jest.clearAllMocks());

  it('lists only the handovers of the employee\'s own projects', async () => {
    const mine = id();
    const access = { ...allow(), visibleProjectIds: jest.fn().mockResolvedValue([mine]) };
    const service = await build(access);
    await service.findAll(employee);
    const pipeline = handoverModel.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({ $match: { project: { $in: [mine] } } });
  });

  it('lists everything for roles that can read all projects', async () => {
    const service = await build(allow());
    await service.findAll({ _id: employee._id, rolePermissions: [PERMISSIONS.PROJECTS_READ_ALL] });
    expect(handoverModel.aggregate.mock.calls[0][0][0]).toEqual({ $match: {} });
  });

  it('narrows a project filter to the projects the user can see (nothing from another project)', async () => {
    const mine = id();
    const service = await build({ ...allow(), visibleProjectIds: jest.fn().mockResolvedValue([mine]) });
    await service.findAll(employee, projectId);
    expect(handoverModel.aggregate.mock.calls[0][0][0]).toEqual({
      $match: { $and: [{ project: { $in: [mine] } }, { project: new Types.ObjectId(projectId) }] },
    });
  });

  it('answers 404 for a malformed project filter', async () => {
    const service = await build(allow());
    await expect(service.findAll(employee, 'nope')).rejects.toThrow('project.not_found');
    expect(handoverModel.aggregate).not.toHaveBeenCalled();
  });

  it('lets a lead also see handovers to or from their own department', async () => {
    const mine = id();
    const service = await build({ ...allow(), visibleProjectIds: jest.fn().mockResolvedValue([mine]) });
    await service.findAll(leadOf(receivingDept));
    expect(handoverModel.aggregate.mock.calls[0][0][0]).toEqual({
      $match: { $or: [{ project: { $in: [mine] } }, { fromDepartment: receivingDept }, { toDepartment: receivingDept }] },
    });
  });

  it('gives no department reach to a plain employee, even if they belong to a department', async () => {
    const mine = id();
    const service = await build({ ...allow(), visibleProjectIds: jest.fn().mockResolvedValue([mine]) });
    await service.findAll({ ...employee, department: receivingDept } as never);
    expect(handoverModel.aggregate.mock.calls[0][0][0]).toEqual({ $match: { project: { $in: [mine] } } });
  });

  it('lets the lead of the SENDING department confirm even if not named on the project', async () => {
    const h = pending('draft', sendingDept, receivingDept);
    handoverModel.findById.mockResolvedValue(h);
    const service = await build(deny());
    await service.confirm(id().toHexString(), leadOf(sendingDept));
    expect(h.status).toBe('confirmed');
    expect(h.save).toHaveBeenCalled();
  });

  it('does not let a lead of an unrelated department confirm', async () => {
    const h = pending('draft', sendingDept, receivingDept);
    handoverModel.findById.mockResolvedValue(h);
    const service = await build(deny());
    await expect(service.confirm(id().toHexString(), leadOf(otherDept))).rejects.toThrow('project.not_found');
    expect(h.save).not.toHaveBeenCalled();
  });

  it('lets the lead of the RECEIVING department accept or reject even if not named on the project', async () => {
    const accepted = pending('confirmed', sendingDept, receivingDept);
    handoverModel.findById.mockResolvedValueOnce(accepted);
    const service = await build(deny());
    await service.accept(id().toHexString(), leadOf(receivingDept));
    expect(accepted.status).toBe('accepted');

    const rejected = pending('confirmed', sendingDept, receivingDept);
    handoverModel.findById.mockResolvedValueOnce(rejected);
    await service.reject(id().toHexString(), 'Edges are chipped', leadOf(receivingDept));
    expect(rejected.status).toBe('rejected');
  });

  it('does not let the SENDING department accept its own handover', async () => {
    const h = pending('confirmed', sendingDept, receivingDept);
    handoverModel.findById.mockResolvedValue(h);
    const service = await build(deny());
    await expect(service.accept(id().toHexString(), leadOf(sendingDept))).rejects.toThrow('project.not_found');
    expect(h.save).not.toHaveBeenCalled();
  });

  it('refuses to raise a handover on someone else\'s project', async () => {
    const service = await build(deny());
    await expect(
      service.raise(
        { projectId, fromDepartmentId: id().toHexString(), toDepartmentId: id().toHexString(), proofFileIds: [id().toHexString()] },
        lead,
      ),
    ).rejects.toThrow('project.not_found');
    expect(handoverModel.create).not.toHaveBeenCalled();
  });

  it.each([
    ['confirm', 'draft'],
    ['accept', 'confirmed'],
  ] as const)('refuses to %s a handover of another project and leaves it unchanged', async (action, status) => {
    const h = pending(status);
    handoverModel.findById.mockResolvedValue(h);
    const service = await build(deny());
    await expect(service[action](id().toHexString(), lead)).rejects.toThrow('project.not_found');
    expect(h.save).not.toHaveBeenCalled();
    expect(h.status).toBe(status);
  });

  it('refuses to reject a handover of another project', async () => {
    const h = pending('confirmed');
    handoverModel.findById.mockResolvedValue(h);
    const service = await build(deny());
    await expect(service.reject(id().toHexString(), 'no', lead)).rejects.toThrow('project.not_found');
    expect(h.save).not.toHaveBeenCalled();
  });
});

// ───────────────────────────── Blockers ─────────────────────────────

describe('BlockersService project isolation', () => {
  const blockerModel = { create: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn() };
  const build = async (access: ReturnType<typeof allow>) => {
    const mod = await Test.createTestingModule({
      providers: [
        BlockersService,
        { provide: getModelToken('Blocker'), useValue: blockerModel },
        { provide: getModelToken('Project'), useValue: { find: jest.fn() } },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: ProjectAccessService, useValue: access },
      ],
    }).compile();
    return mod.get(BlockersService);
  };
  const manager = {
    _id: employee._id,
    rolePermissions: [PERMISSIONS.BLOCKERS_RAISE, PERMISSIONS.BLOCKERS_RESOLVE, PERMISSIONS.BLOCKERS_TRIGGER_SLA],
  };
  const existing = () => ({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue({ project: id() }) });

  beforeEach(() => jest.clearAllMocks());

  it('refuses to raise a blocker on a project the user is not on', async () => {
    const service = await build(deny());
    await expect(service.raise({ projectId, title: 'Power cut', type: 'internal' }, manager)).rejects.toThrow('project.not_found');
    expect(blockerModel.create).not.toHaveBeenCalled();
  });

  it('refuses to resolve a blocker of another project', async () => {
    blockerModel.findById.mockReturnValue(existing());
    const service = await build(deny());
    await expect(service.resolve(id().toHexString(), manager)).rejects.toThrow('project.not_found');
    expect(blockerModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses to escalate (trigger SLA on) a blocker of another project', async () => {
    blockerModel.findById.mockReturnValue(existing());
    const service = await build(deny());
    await expect(service.triggerSla(id().toHexString(), manager)).rejects.toThrow('project.not_found');
    expect(blockerModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown blocker id', async () => {
    blockerModel.findById.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) });
    const service = await build(allow());
    await expect(service.resolve(id().toHexString(), manager)).rejects.toThrow('blocker.not_found');
  });

  it('still resolves a blocker the user can see', async () => {
    blockerModel.findById.mockReturnValue(existing());
    blockerModel.findByIdAndUpdate.mockResolvedValue({ _id: id() });
    const service = await build(allow());
    await service.resolve(id().toHexString(), manager);
    expect(blockerModel.findByIdAndUpdate).toHaveBeenCalled();
  });
});

// ───────────────────────────── Chat channels ─────────────────────────────

describe('ChatGroupsService.canAccessChannel', () => {
  const groupModel = { findOne: jest.fn() };
  let service: ChatGroupsService;
  const me = id();
  const group = (g: object | null) =>
    groupModel.findOne.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(g) });

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        ChatGroupsService,
        { provide: getModelToken('ChatGroup'), useValue: groupModel },
        { provide: getModelToken('Message'), useValue: {} },
      ],
    }).compile();
    service = mod.get(ChatGroupsService);
  });

  it('lets a member in', async () => {
    group({ type: 'project', members: [me] });
    expect(await service.canAccessChannel(String(me), false, 'project:1')).toBe(true);
  });

  it('keeps a non-member out of a project, team or direct chat', async () => {
    group({ type: 'project', members: [id()] });
    expect(await service.canAccessChannel(String(me), false, 'project:1')).toBe(false);
  });

  it('lets anyone into department chats', async () => {
    group({ type: 'department', members: [] });
    expect(await service.canAccessChannel(String(me), false, 'dept:1')).toBe(true);
  });

  it('lets read-all roles (MD, GM) in', async () => {
    group({ type: 'custom', members: [id()] });
    expect(await service.canAccessChannel(String(me), true, 'group:1')).toBe(true);
  });

  it('keeps everyone out of a channel that has no active group', async () => {
    group(null);
    expect(await service.canAccessChannel(String(me), true, 'made-up-channel')).toBe(false);
    expect(groupModel.findOne).toHaveBeenCalledWith({ channel: 'made-up-channel', isActive: true });
  });
});

describe('MessagesGateway channel access', () => {
  const messageModel = { create: jest.fn(), updateMany: jest.fn() };
  const userModel = { find: jest.fn() };
  const chatGroups = { canAccessChannel: jest.fn() };
  const emit = jest.fn();
  let gateway: MessagesGateway;
  const socket = (canReadAll = false) => ({ data: { userId: employee._id, name: 'Emp', canReadAll }, join: jest.fn() });

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new MessagesGateway(
      {} as never,
      messageModel as never,
      userModel as never,
      {} as never,
      chatGroups as never,
      { sendToMany: jest.fn() } as never,
    );
    gateway.server = { to: () => ({ emit }) } as never;
  });

  it('does not let a user join a channel they cannot access', async () => {
    chatGroups.canAccessChannel.mockResolvedValue(false);
    const s = socket();
    const result = await gateway.handleJoinChannel(s as never, 'project:someone-elses');
    expect(s.join).not.toHaveBeenCalled();
    expect(result).toEqual({ event: 'error', data: 'messages.channel_access_denied' });
  });

  it('joins an accessible channel and passes the read-all flag through', async () => {
    chatGroups.canAccessChannel.mockResolvedValue(true);
    const s = socket(true);
    await gateway.handleJoinChannel(s as never, 'project:mine');
    expect(chatGroups.canAccessChannel).toHaveBeenCalledWith(employee._id, true, 'project:mine');
    expect(s.join).toHaveBeenCalledWith('project:mine');
  });

  it('does not store a message sent to a channel the user cannot access', async () => {
    chatGroups.canAccessChannel.mockResolvedValue(false);
    const result = await gateway.handleMessage(socket() as never, { channel: 'project:x', body: 'hi' });
    expect(messageModel.create).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(result).toEqual({ event: 'error', data: 'messages.channel_access_denied' });
  });

  it('ignores empty or non-string message bodies', async () => {
    chatGroups.canAccessChannel.mockResolvedValue(true);
    await gateway.handleMessage(socket() as never, { channel: 'project:x', body: '   ' });
    await gateway.handleMessage(socket() as never, { channel: 'project:x', body: 42 as unknown as string });
    expect(messageModel.create).not.toHaveBeenCalled();
  });

  it('does not mark messages read in a channel the user cannot access', async () => {
    chatGroups.canAccessChannel.mockResolvedValue(false);
    await gateway.handleMarkRead(socket() as never, { channel: 'project:x', messageId: 'm' });
    expect(messageModel.updateMany).not.toHaveBeenCalled();
  });

  it('looks up at most 10 mentions, as escaped literals', async () => {
    chatGroups.canAccessChannel.mockResolvedValue(true);
    userModel.find.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) });
    messageModel.create.mockResolvedValue({ populate: jest.fn().mockResolvedValue({ toObject: () => ({ channel: 'project:x' }) }) });
    const body = Array.from({ length: 25 }, (_, i) => `@user${i}`).join(' ');
    await gateway.handleMessage(socket() as never, { channel: 'project:x', body });
    const patterns = userModel.find.mock.calls[0][0].name.$in as RegExp[];
    expect(patterns.length).toBeLessThanOrEqual(10);
    expect(patterns.every((p) => p instanceof RegExp)).toBe(true);
  });
});

describe('escapeRegExp', () => {
  it('turns pattern characters into literals', () => {
    const evil = '(a+)+$ .* [x]';
    const re = new RegExp(escapeRegExp(evil));
    expect(re.test(evil)).toBe(true);
    expect(re.test('aaaa')).toBe(false);
    expect(escapeRegExp('plain name')).toBe('plain name');
  });
});
