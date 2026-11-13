// ─── Common ──────────────────────────────────────────────────────────────────

export type ID = string;

export interface BaseEntity {
  _id: ID;
  createdAt: string;
  updatedAt: string;
  createdBy: ID;
}

// ─── Enums ───────────────────────────────────────────────────────────────────

export type Language = 'en' | 'ta';

export type LeadSource = 'marketing' | 'referral' | 'walkin' | 'other';

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export type HandoverStatus = 'draft' | 'confirmed' | 'accepted' | 'rejected';

export type PurchaseItemStatus = 'pending' | 'ordered' | 'received';

export type BlockerType = 'internal' | 'client_side';
export type BlockerStatus = 'open' | 'sla_triggered' | 'resolved';

export type ApprovalKind =
  | 'quotation'
  | 'order_confirmation'
  | 'client_update'
  | 'drawing';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type DocumentType =
  | 'photo'
  | 'drawing_2d'
  | 'drawing_3d'
  | 'quotation'
  | 'invoice'
  | 'other';

// ─── Entities ────────────────────────────────────────────────────────────────

export interface Department extends BaseEntity {
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
  defaultSlaHours: number;
}

export interface Role extends BaseEntity {
  name: string;
  permissions: string[];
  isSystem: boolean;
}

export interface User extends BaseEntity {
  name: string;
  email: string;
  phone: string;
  role: ID | Role;
  department: ID | Department;
  reportsTo?: ID | User;
  assignedProjects: ID[];
  fcmToken?: string;
  mfaEnabled: boolean;
  isActive: boolean;
  preferredLanguage: Language;
}

export interface Client extends BaseEntity {
  name: string;
  phone: string;
  email?: string;
  location?: { type: 'Point'; coordinates: [number, number] };
  address?: string;
  leadSource: LeadSource;
  referredBy?: string;
  notes?: string;
  whatsappOptIn: boolean;
}

export interface StageHistoryEntry {
  stage: ID;
  enteredAt: string;
  completedAt?: string;
}

export interface AdditionalWork {
  description: string;
  amount: number;
  notifiedClient: boolean;
  drawingRequired: boolean;
}

export interface Project extends BaseEntity {
  client: ID | Client;
  title: string;
  currentStage: ID | Department;
  stageHistory: StageHistoryEntry[];
  progressPct: number;
  stageWeights?: Record<string, number>;
  assignedTeam: ID[];
  targetDate?: string;
  status: ProjectStatus;
  requiresDrawing: boolean;
  /** Last shade-card revision sent to the client (0 = never sent) */
  shadeCardRevision?: number;
  additionalWork: AdditionalWork[];
}

export interface Task extends BaseEntity {
  project: ID | Project;
  department: ID | Department;
  title: string;
  description?: string;
  assignedTo: ID | User;
  status: TaskStatus;
  dueDate?: string;
  completedAt?: string;
  offlineCreatedAt?: string;
  photos: ID[];
}

export interface Handover extends BaseEntity {
  project: ID | Project;
  fromDepartment: ID | Department;
  toDepartment: ID | Department;
  raisedBy: ID | User;
  confirmedBy?: ID | User;
  acceptedBy?: ID | User;
  status: HandoverStatus;
  rejectionReason?: string;
  proofFiles: ID[];
  notes?: string;
}

export interface PurchaseItem extends BaseEntity {
  project: ID | Project;
  /** Display order (S.No) within the project */
  slNo: number;
  area: string;
  /** Item name */
  item: string;
  brand: string;
  code: string;
  size: string;
  finish: string;
  /** Order qty — cumulative total requested by Design */
  quantity: number;
  /** Ordered qty — entered manually by Purchase (total ordered so far) */
  orderedQty: number;
  /** Received qty — entered manually by Purchase (total received so far) */
  receivedQty: number;
  /** Yet to order = quantity - orderedQty (computed by the API) */
  yetToOrderQty: number;
  /** Balance qty = quantity - receivedQty (computed by the API) */
  balanceQty: number;
  /** Derived from the quantities. 'pending' is shown as "Yet to order". */
  status: PurchaseItemStatus;
  orderedAt?: string;
  receivedAt?: string;
}

export interface Blocker extends BaseEntity {
  project: ID | Project;
  raisedBy: ID | User;
  title: string;
  description: string;
  type: BlockerType;
  status: BlockerStatus;
  slaTriggeredAt?: string;
  slaTriggeredBy?: ID | User;
  resolvedAt?: string;
  resolvedBy?: ID | User;
}

export interface Approval extends BaseEntity {
  project: ID | Project;
  kind: ApprovalKind;
  requestedBy: ID | User;
  approver?: ID | User;
  status: ApprovalStatus;
  rejectionReason?: string;
  linkedDocument?: ID;
  approvedAt?: string;
  whatsappScheduled: boolean;
}

export interface Document extends BaseEntity {
  project: ID | Project;
  driveFileId: string;
  driveLink: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  version: number;
  type: DocumentType;
  uploadedBy: ID | User;
  department: ID | Department;
}

export interface Message extends BaseEntity {
  channel: string;
  sender: ID | User;
  body: string;
  attachments: ID[];
  readBy: Array<{ user: ID; readAt: string }>;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type ChatGroupType = 'department' | 'project' | 'individual' | 'custom';

export interface UserSummary {
  _id: string;
  name: string;
  email: string;
}

export interface ChatGroup extends BaseEntity {
  name: string;
  displayName?: string;
  type: ChatGroupType;
  channel: string;
  members: UserSummary[];
  projectRef?: { _id: string; title: string };
  departmentRef?: { _id: string; name: string };
  isAutoCreated: boolean;
  isActive: boolean;
  lastMessage?: { body: string; senderName: string; createdAt: string } | null;
}

export interface ChatMessage extends BaseEntity {
  channel: string;
  sender: UserSummary | string;
  body: string;
  attachments?: Array<{ _id: string; fileName: string; driveLink: string }>;
  mentions?: UserSummary[];
  mediaType?: 'image' | 'video' | 'audio' | 'file' | null;
  mediaUrl?: string | null;
  readBy?: Array<{ user: string; readAt: string }>;
  _sending?: boolean;
}

export interface SlaSettings extends BaseEntity {
  department: ID | Department;
  defaultHours: number;
  updatedBy: ID | User;
}

export interface ActivityLog {
  _id: ID;
  actor: ID | User;
  action: string;
  entity: string;
  entityId: ID;
  metadata?: Record<string, unknown>;
  createdAt: string;
  createdBy: ID;
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  statusCode: number;
  messageKey: string;
  details?: unknown;
}
