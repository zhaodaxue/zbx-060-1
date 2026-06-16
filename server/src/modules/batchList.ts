import { getDb } from '../db';
import type { BatchWithMaterial, BatchListItem } from '../types';

export function getBatchListByMaterial(): BatchWithMaterial[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT id, material_code, batch_no, total_quantity, remaining_quantity, latest_inbound_time
    FROM batches
    ORDER BY material_code ASC, latest_inbound_time DESC
  `).all() as {
    id: string;
    material_code: string;
    batch_no: string;
    total_quantity: number;
    remaining_quantity: number;
    latest_inbound_time: string;
  }[];

  const materialMap = new Map<string, BatchListItem[]>();

  for (const row of rows) {
    const item: BatchListItem = {
      id: row.id,
      batchNo: row.batch_no,
      materialCode: row.material_code,
      remainingQuantity: row.remaining_quantity,
      latestInboundTime: row.latest_inbound_time,
      totalQuantity: row.total_quantity,
    };

    if (materialMap.has(row.material_code)) {
      materialMap.get(row.material_code)!.push(item);
    } else {
      materialMap.set(row.material_code, [item]);
    }
  }

  const result: BatchWithMaterial[] = [];
  for (const [materialCode, batches] of materialMap.entries()) {
    result.push({
      materialCode,
      batches: batches.sort((a, b) => {
        if (a.remainingQuantity === 0 && b.remainingQuantity !== 0) return 1;
        if (a.remainingQuantity !== 0 && b.remainingQuantity === 0) return -1;
        return new Date(b.latestInboundTime).getTime() - new Date(a.latestInboundTime).getTime();
      }),
    });
  }

  return result.sort((a, b) => a.materialCode.localeCompare(b.materialCode));
}

export function getAvailableBatches(): BatchListItem[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT id, material_code, batch_no, total_quantity, remaining_quantity, latest_inbound_time
    FROM batches
    WHERE remaining_quantity > 0
    ORDER BY material_code ASC, latest_inbound_time DESC
  `).all() as {
    id: string;
    material_code: string;
    batch_no: string;
    total_quantity: number;
    remaining_quantity: number;
    latest_inbound_time: string;
  }[];

  return rows.map(row => ({
    id: row.id,
    batchNo: row.batch_no,
    materialCode: row.material_code,
    remainingQuantity: row.remaining_quantity,
    latestInboundTime: row.latest_inbound_time,
    totalQuantity: row.total_quantity,
  }));
}
