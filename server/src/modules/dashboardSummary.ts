import { getDb } from '../db';
import type { DashboardStats } from '../types';

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);

  const todayInboundCountRow = db.prepare(`
    SELECT COUNT(*) as count
    FROM inbound_records
    WHERE DATE(inbound_time) = ?
  `).get(todayStart) as { count: number };

  const totalRemainingRow = db.prepare(`
    SELECT COALESCE(SUM(remaining_quantity), 0) as total
    FROM batches
    WHERE remaining_quantity > 0
  `).get() as { total: number };

  const todayOutboundRow = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as total
    FROM outbound_records
    WHERE DATE(outbound_time) = ?
  `).get(todayStart) as { total: number };

  return {
    todayInboundCount: todayInboundCountRow.count,
    totalRemainingQuantity: totalRemainingRow.total,
    todayOutboundQuantity: todayOutboundRow.total,
  };
}
