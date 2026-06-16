import { getDb } from '../db';

export interface OutboundDetail {
  outboundNo: string;
  receiverCode: string;
  quantity: number;
  outboundTime: string;
  materialCode: string;
  batchNo: string;
}

export function getBatchLatestOutbound(batchId: string): OutboundDetail | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT outbound_no, receiver_code, quantity, outbound_time, material_code, batch_no
    FROM outbound_records
    WHERE batch_id = ?
    ORDER BY outbound_time DESC
    LIMIT 1
  `).get(batchId) as {
    outbound_no: string;
    receiver_code: string;
    quantity: number;
    outbound_time: string;
    material_code: string;
    batch_no: string;
  } | undefined;

  if (!row) {
    return null;
  }

  return {
    outboundNo: row.outbound_no,
    receiverCode: row.receiver_code,
    quantity: row.quantity,
    outboundTime: row.outbound_time,
    materialCode: row.material_code,
    batchNo: row.batch_no,
  };
}
