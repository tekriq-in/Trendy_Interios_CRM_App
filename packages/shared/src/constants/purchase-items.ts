import type { PurchaseItemStatus } from '../types/index';

/** UI labels for purchase item statuses. 'pending' is stored, "Yet to order" is shown. */
export const PURCHASE_ITEM_STATUS_LABELS: Record<PurchaseItemStatus, string> = {
  pending: 'Yet to order',
  ordered: 'Ordered',
  received: 'Received',
};

/** The six descriptive fields that identify "the same item" within a project. */
export interface PurchaseItemIdentity {
  area?: string;
  item: string;
  brand?: string;
  code?: string;
  size?: string;
  finish?: string;
}

function normalize(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Key used to merge repeated additions into one row (cumulative quantity).
 * All six fields must match, ignoring case and extra whitespace.
 */
export function purchaseItemMatchKey(identity: PurchaseItemIdentity): string {
  return [identity.area, identity.item, identity.brand, identity.code, identity.size, identity.finish]
    .map(normalize)
    .join('|');
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Balance qty = order qty - received qty, never negative. */
export function purchaseItemBalance(quantity: number, receivedQty: number): number {
  return Math.max(0, round3(quantity - receivedQty));
}

/** Yet to order = order qty - ordered qty, never negative. */
export function purchaseItemYetToOrder(quantity: number, orderedQty: number): number {
  return Math.max(0, round3(quantity - orderedQty));
}

/**
 * Status is derived from the quantities — never set by hand:
 * - everything received          → 'received'
 * - everything ordered           → 'ordered'  (waiting for delivery)
 * - something still not ordered  → 'pending'  ("Yet to order")
 */
export function derivePurchaseItemStatus(
  quantity: number,
  orderedQty: number,
  receivedQty: number,
): PurchaseItemStatus {
  if (purchaseItemBalance(quantity, receivedQty) === 0) return 'received';
  if (purchaseItemYetToOrder(quantity, orderedQty) === 0) return 'ordered';
  return 'pending';
}
