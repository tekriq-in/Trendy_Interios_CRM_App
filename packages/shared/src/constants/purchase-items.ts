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

/** Balance qty = order qty - received qty, never negative. Rounded to 3dp to avoid float noise. */
export function purchaseItemBalance(quantity: number, receivedQty: number): number {
  return Math.max(0, Math.round((quantity - receivedQty) * 1000) / 1000);
}

/**
 * Status after a change.
 * - Fully received → 'received'
 * - Otherwise the requested status, or the current one if none was requested
 *   (a row that was 'received' but now has a balance falls back to 'pending').
 */
export function derivePurchaseItemStatus(
  quantity: number,
  receivedQty: number,
  requested: PurchaseItemStatus | undefined,
  current: PurchaseItemStatus,
): PurchaseItemStatus {
  if (purchaseItemBalance(quantity, receivedQty) === 0) return 'received';
  const next = requested ?? current;
  return next === 'received' ? 'pending' : next;
}
