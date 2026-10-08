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

export type PaymentKind = 'advance' | 'periodic' | 'final';

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
  advance?: number;
  advancePaidAt?: string;
  requiresDrawing: boolean;
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
  item: string;
  description?: string;
  quantity: number;
  unit?: string;
  supplier?: string;
  status: PurchaseItemStatus;
  orderedAt?: string;
  receivedAt?: string;
  linkedDocument?: ID;
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

export interface Payment extends BaseEntity {
  project: ID | Project;
  kind: PaymentKind;
  amount: number;
  paidAt?: string;
  collectedBy: ID | User;
  notes?: string;
  followUpSentAt?: string;
  followUpApprovedBy?: ID | User;
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
