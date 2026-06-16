import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { validateInbound } from './inboundValidation';
import type { InboundRecord, Batch } from '../types';

export interface InboundCreateInput {
  materialCode: string;
  batchNo: string;
  quantity: number;
  inboundTime: string;
}

export interface InboundCreateResult {
  success: boolean;
  error?: string;
  inboundNo?: string;
  batchId?: string;
}

export function createInbound(input: InboundCreateInput): InboundCreateResult {
  const validateResult = validateInbound(input);
  if (!validateResult.valid) {
    return { success: false, error: validateResult.error };
  }

  const db = getDb();
  const transaction = db.transaction(() => {
    const batchId = uuidv4();
    const inboundNo = generateInboundNo();
    const now = formatLocalNow();
    const inboundTime = formatInboundTime(input.inboundTime);

    db.prepare(`
      INSERT INTO batches (id, material_code, batch_no, total_quantity, remaining_quantity, latest_inbound_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      batchId,
      input.materialCode,
      input.batchNo,
      input.quantity,
      input.quantity,
      inboundTime,
      now
    );

    db.prepare(`
      INSERT INTO inbound_records (id, inbound_no, material_code, batch_no, quantity, inbound_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      inboundNo,
      input.materialCode,
      input.batchNo,
      input.quantity,
      inboundTime,
      now
    );

    return { batchId, inboundNo };
  });

  try {
    const result = transaction();
    return {
      success: true,
      inboundNo: result.inboundNo,
      batchId: result.batchId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: `入库失败：${message}` };
  }
}

function generateInboundNo(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `IB${dateStr}${random}`;
}

function formatInboundTime(timeStr: string): string {
  const [datePart, timePart] = timeStr.split(' ');
  return `${datePart} ${timePart}:00`;
}

function formatLocalNow(): string {
  const now = new Date();
  return now.getFullYear().toString() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');
}
