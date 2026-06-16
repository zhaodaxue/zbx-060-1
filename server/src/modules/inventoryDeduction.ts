import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface OutboundDeductInput {
  batchId: string;
  quantity: number;
  receiverCode: string;
}

export interface DeductResult {
  success: boolean;
  error?: string;
  outboundNo?: string;
  remainingQuantity?: number;
}

export interface OutboundValidateInput {
  batchId: string;
  quantity: number;
  receiverCode: string;
}

export function validateOutboundInput(input: OutboundValidateInput): DeductResult {
  if (!input.batchId || input.batchId.trim() === '') {
    return { success: false, error: '批次 ID 不能为空' };
  }

  if (!input.quantity || input.quantity <= 0) {
    return { success: false, error: '调拨件数必须大于 0' };
  }

  if (!Number.isInteger(input.quantity)) {
    return { success: false, error: '调拨件数必须为整数' };
  }

  if (!input.receiverCode || input.receiverCode.trim() === '') {
    return { success: false, error: '接收单位代号不能为空' };
  }

  return { success: true };
}

export function checkBatchStock(batchId: string, quantity: number): DeductResult {
  const db = getDb();
  const batch = db.prepare('SELECT id, remaining_quantity, material_code, batch_no FROM batches WHERE id = ?').get(batchId) as {
    id: string;
    remaining_quantity: number;
    material_code: string;
    batch_no: string;
  } | undefined;

  if (!batch) {
    return { success: false, error: '批次不存在' };
  }

  if (batch.remaining_quantity <= 0) {
    return { success: false, error: '该批次库存已耗尽' };
  }

  if (quantity > batch.remaining_quantity) {
    return { success: false, error: `调拨件数 ${quantity} 超过该批次剩余库存 ${batch.remaining_quantity}` };
  }

  return { success: true };
}

export function deductStock(input: OutboundDeductInput): DeductResult {
  const inputResult = validateOutboundInput(input);
  if (!inputResult.success) {
    return inputResult;
  }

  const stockResult = checkBatchStock(input.batchId, input.quantity);
  if (!stockResult.success) {
    return stockResult;
  }

  const db = getDb();
  const transaction = db.transaction(() => {
    const batch = db.prepare('SELECT id, material_code, batch_no, remaining_quantity FROM batches WHERE id = ?').get(input.batchId) as {
      id: string;
      material_code: string;
      batch_no: string;
      remaining_quantity: number;
    } | undefined;

    if (!batch) {
      throw new Error('批次不存在');
    }

    if (batch.remaining_quantity < input.quantity) {
      throw new Error(`调拨件数 ${input.quantity} 超过该批次剩余库存 ${batch.remaining_quantity}`);
    }

    const updateResult = db.prepare(
      'UPDATE batches SET remaining_quantity = remaining_quantity - ? WHERE id = ? AND remaining_quantity >= ?'
    ).run(input.quantity, input.batchId, input.quantity);

    if (updateResult.changes === 0) {
      throw new Error('库存不足，调拨失败');
    }

    const updatedBatch = db.prepare('SELECT remaining_quantity FROM batches WHERE id = ?').get(input.batchId) as {
      remaining_quantity: number;
    };

    const outboundNo = generateOutboundNo();
    const now = formatLocalNow();
    const outboundTime = now;

    db.prepare(`
      INSERT INTO outbound_records (id, outbound_no, batch_id, material_code, batch_no, quantity, receiver_code, outbound_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      outboundNo,
      input.batchId,
      batch.material_code,
      batch.batch_no,
      input.quantity,
      input.receiverCode,
      outboundTime,
      now
    );

    return { outboundNo, remainingQuantity: updatedBatch.remaining_quantity };
  });

  try {
    const result = transaction();
    return {
      success: true,
      outboundNo: result.outboundNo,
      remainingQuantity: result.remainingQuantity,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: `库存扣减失败：${message}` };
  }
}

function generateOutboundNo(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `OB${dateStr}${random}`;
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
