import { getDb } from '../db';

export interface InboundValidateInput {
  materialCode: string;
  batchNo: string;
  quantity: number;
  inboundTime: string;
}

export interface ValidateResult {
  valid: boolean;
  error?: string;
}

export function validateInboundInput(input: InboundValidateInput): ValidateResult {
  if (!input.materialCode || input.materialCode.trim() === '') {
    return { valid: false, error: '物资代号不能为空' };
  }

  if (!input.batchNo || input.batchNo.trim() === '') {
    return { valid: false, error: '批次号不能为空' };
  }

  if (!input.quantity || input.quantity <= 0) {
    return { valid: false, error: '件数必须大于 0' };
  }

  if (!Number.isInteger(input.quantity)) {
    return { valid: false, error: '件数必须为整数' };
  }

  if (!input.inboundTime) {
    return { valid: false, error: '入库时刻不能为空' };
  }

  const timeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
  if (!timeRegex.test(input.inboundTime)) {
    return { valid: false, error: '入库时刻格式不正确，应为 YYYY-MM-DD HH:mm' };
  }

  return { valid: true };
}

export function checkBatchUnique(batchNo: string): ValidateResult {
  const db = getDb();
  const row = db.prepare('SELECT id FROM batches WHERE batch_no = ?').get(batchNo) as { id: string } | undefined;

  if (row) {
    return { valid: false, error: `批次号 ${batchNo} 已存在，不可重复入库` };
  }

  return { valid: true };
}

export function validateInbound(input: InboundValidateInput): ValidateResult {
  const basicResult = validateInboundInput(input);
  if (!basicResult.valid) {
    return basicResult;
  }

  const uniqueResult = checkBatchUnique(input.batchNo);
  if (!uniqueResult.valid) {
    return uniqueResult;
  }

  return { valid: true };
}
