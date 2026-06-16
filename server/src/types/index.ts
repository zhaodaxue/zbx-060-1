export interface Batch {
  id: string;
  materialCode: string;
  batchNo: string;
  totalQuantity: number;
  remainingQuantity: number;
  latestInboundTime: string;
  createdAt: string;
}

export interface InboundRecord {
  id: string;
  inboundNo: string;
  materialCode: string;
  batchNo: string;
  quantity: number;
  inboundTime: string;
  createdAt: string;
}

export interface OutboundRecord {
  id: string;
  outboundNo: string;
  batchId: string;
  materialCode: string;
  batchNo: string;
  quantity: number;
  receiverCode: string;
  outboundTime: string;
  createdAt: string;
}

export interface DashboardStats {
  todayInboundCount: number;
  totalRemainingQuantity: number;
  todayOutboundQuantity: number;
}

export interface BatchWithMaterial {
  materialCode: string;
  batches: BatchListItem[];
}

export interface BatchListItem {
  id: string;
  batchNo: string;
  remainingQuantity: number;
  latestInboundTime: string;
  totalQuantity: number;
}
