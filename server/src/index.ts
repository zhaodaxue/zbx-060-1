import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './db';
import { createInbound } from './modules/inboundService';
import { deductStock } from './modules/inventoryDeduction';
import { getDashboardStats } from './modules/dashboardSummary';
import { getBatchListByMaterial, getAvailableBatches } from './modules/batchList';

const app = express();
const PORT = process.env.PORT || 3000;

initDatabase();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/dashboard/stats', (req, res) => {
  try {
    const stats = getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    res.json({ success: false, error: message });
  }
});

app.get('/api/batches/by-material', (req, res) => {
  try {
    const batches = getBatchListByMaterial();
    res.json({ success: true, data: batches });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    res.json({ success: false, error: message });
  }
});

app.get('/api/batches/available', (req, res) => {
  try {
    const batches = getAvailableBatches();
    res.json({ success: true, data: batches });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    res.json({ success: false, error: message });
  }
});

app.post('/api/inbound', (req, res) => {
  try {
    const { materialCode, batchNo, quantity, inboundTime } = req.body;
    const result = createInbound({ materialCode, batchNo, quantity, inboundTime });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    res.json({ success: false, error: message });
  }
});

app.post('/api/outbound', (req, res) => {
  try {
    const { batchId, quantity, receiverCode } = req.body;
    const result = deductStock({ batchId, quantity, receiverCode });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    res.json({ success: false, error: message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
