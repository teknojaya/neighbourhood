import { z } from 'zod';
import { DomainError } from './state-machine.js';

/**
 * Quantity accounting is separate from listing status. A listing can be
 * `active` with zero available units (all reserved), or `paused` with stock.
 *
 *   available = total - reserved - collected
 *
 * - Pending requests do NOT reserve stock.
 * - Approval reserves (conditional UPDATE inside a PostgreSQL transaction).
 * - Cancellation/expiry of an approved request releases.
 * - Collection moves units from reserved to collected.
 */
export const StockSchema = z
  .object({
    total: z.number().int().min(0).max(10_000),
    reserved: z.number().int().min(0),
    collected: z.number().int().min(0),
  })
  .refine((s) => s.reserved + s.collected <= s.total, 'reserved + collected exceeds total');
export type Stock = z.infer<typeof StockSchema>;

const assertQty = (qty: number) => {
  if (!Number.isInteger(qty) || qty < 1) throw new DomainError('BAD_REQUEST', 'Quantity must be a positive integer');
};

export const availableUnits = (s: Stock): number => s.total - s.reserved - s.collected;

export function reserveStock(s: Stock, qty: number): Stock {
  assertQty(qty);
  if (availableUnits(s) < qty) throw new DomainError('INSUFFICIENT_STOCK', 'Not enough units available');
  return { ...s, reserved: s.reserved + qty };
}

export function releaseStock(s: Stock, qty: number): Stock {
  assertQty(qty);
  if (s.reserved < qty) throw new DomainError('CONFLICT', 'Cannot release more units than reserved');
  return { ...s, reserved: s.reserved - qty };
}

export function collectStock(s: Stock, qty: number): Stock {
  assertQty(qty);
  if (s.reserved < qty) throw new DomainError('CONFLICT', 'Cannot collect units that were not reserved');
  return { ...s, reserved: s.reserved - qty, collected: s.collected + qty };
}

/** Owner edits to total must never drop below committed units. */
export function setTotalStock(s: Stock, total: number): Stock {
  if (!Number.isInteger(total) || total < s.reserved + s.collected) {
    throw new DomainError('CONFLICT', 'Total cannot be lower than reserved + collected units');
  }
  return { ...s, total };
}
