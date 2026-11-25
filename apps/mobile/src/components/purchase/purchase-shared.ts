import axios from 'axios';
import type { PurchaseItemStatus } from '@ti/shared';

export interface PurchaseItem {
  _id: string;
  slNo: number;
  area: string;
  item: string;
  brand: string;
  code: string;
  size: string;
  finish: string;
  quantity: number;
  orderedQty: number;
  receivedQty: number;
  yetToOrderQty: number;
  balanceQty: number;
  status: PurchaseItemStatus;
}

/** Whole numbers stay whole; fractions (metres, kg) are trimmed to 3 decimals. */
export function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
}

const ERROR_KEYS: Record<string, string> = {
  'purchase_item.received_exceeds_order': 'purchase.err_received_exceeds_order',
  'purchase_item.ordered_exceeds_order': 'purchase.err_ordered_exceeds_order',
  'purchase_item.ordered_below_received': 'purchase.err_ordered_below_received',
  'auth.insufficient_permissions': 'purchase.err_no_permission',
  'project.not_found': 'purchase.err_no_access',
};

/** Translation key for a known API error, or null for anything else (use the generic message). */
export function purchaseErrorKey(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const msg = (err.response?.data as { message?: string | string[] } | undefined)?.message;
  const first = Array.isArray(msg) ? msg[0] : msg;
  return (first && ERROR_KEYS[first]) || null;
}
