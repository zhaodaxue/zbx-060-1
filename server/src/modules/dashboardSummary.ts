import { getDb } from '../db';
import type { DashboardStats } from '../types';

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  const now = new Date();
  const todayStr = now.getFullYear().toString() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');
  const todayStart = `${todayStr} 00:00:00`;
  const todayEnd = `${todayStr} 23:59:59`;

  const todayInboundCountRow = db.prepare(`
    SELECT COUNT(*) as count
    FROM inbound_records
    WHERE inbound_time >= ? AND inbound_time <= ?
  `).get(todayStart, todayEnd) as { count: number };

  const totalRemainingRow = db.prepare(`
    SELECT COALESCE(SUM(remaining_quantity), 0) as total
    FROM batches
    WHERE remaining_quantity > 0
  `).get() as { total: number };

  const todayOutboundRow = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as total
    FROM outbound_records
    WHERE outbound_time >= ? AND outbound_time <= ?
  `).get(todayStart, todayEnd) as { total: number };

  return {
    todayInboundCount: todayInboundCountRow.count,
    totalRemainingQuantity: totalRemainingRow.total,
    todayOutboundQuantity: todayOutboundRow.total,
  };
}
