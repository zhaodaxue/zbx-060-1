const API_BASE = '/api';

const pages = {
  dashboard: document.getElementById('dashboardPage'),
  inbound: document.getElementById('inboundPage'),
  outbound: document.getElementById('outboundPage'),
};

const pageTitles = {
  dashboard: '首页总览',
  inbound: '入库登记',
  outbound: '调拨出库',
};

const navItems = document.querySelectorAll('.nav-item');

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const pageName = item.dataset.page;
    switchPage(pageName);
  });
});

function switchPage(pageName) {
  Object.keys(pages).forEach(key => {
    pages[key].classList.remove('active');
  });
  pages[pageName].classList.add('active');

  navItems.forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === pageName) {
      item.classList.add('active');
    }
  });

  document.getElementById('pageTitle').textContent = pageTitles[pageName];

  if (pageName === 'dashboard') {
    loadDashboardStats();
  } else if (pageName === 'outbound') {
    loadAvailableBatches();
  }

  loadBatchList();
}

async function loadDashboardStats() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    const data = await res.json();
    if (data.success) {
      document.getElementById('todayInboundCount').textContent = data.data.todayInboundCount;
      document.getElementById('totalRemainingQuantity').textContent = data.data.totalRemainingQuantity;
      document.getElementById('todayOutboundQuantity').textContent = data.data.todayOutboundQuantity;
    }
  } catch (err) {
    console.error('加载首页数据失败:', err);
  }
}

async function loadBatchList() {
  try {
    const res = await fetch(`${API_BASE}/batches/by-material`);
    const data = await res.json();
    const container = document.getElementById('batchList');

    if (!data.success || data.data.length === 0) {
      container.innerHTML = '<div class="loading">暂无批次数据</div>';
      return;
    }

    let html = '';
    for (const group of data.data) {
      html += `
        <div class="material-group">
          <div class="material-group-title">${escapeHtml(group.materialCode)}</div>
      `;
      for (const batch of group.batches) {
        const isDepleted = batch.remainingQuantity === 0;
        const statusClass = isDepleted ? 'depleted' : 'available';
        const timeStr = formatDateTime(batch.latestInboundTime);
        html += `
          <div class="batch-item ${statusClass}" data-batch-id="${batch.id}" data-available="${!isDepleted}">
            <div class="batch-no">${escapeHtml(batch.batchNo)}</div>
            <div class="batch-info">剩余 ${batch.remainingQuantity} / ${timeStr}</div>
          </div>
        `;
      }
      html += '</div>';
    }
    container.innerHTML = html;
  } catch (err) {
    console.error('加载批次列表失败:', err);
    document.getElementById('batchList').innerHTML = '<div class="loading">加载失败</div>';
  }
}

async function loadAvailableBatches() {
  try {
    const res = await fetch(`${API_BASE}/batches/available`);
    const data = await res.json();
    const select = document.getElementById('outboundBatch');

    select.innerHTML = '<option value="">请选择批次（仅显示有库存的）</option>';

    if (data.success && data.data.length > 0) {
      for (const batch of data.data) {
        const option = document.createElement('option');
        option.value = batch.id;
        option.textContent = `${batch.materialCode} / ${batch.batchNo} (剩余: ${batch.remainingQuantity}件)`;
        option.dataset.stock = batch.remainingQuantity;
        option.dataset.batchNo = batch.batchNo;
        option.dataset.materialCode = batch.materialCode;
        select.appendChild(option);
      }
    }
  } catch (err) {
    console.error('加载可用批次失败:', err);
  }
}

document.getElementById('outboundBatch').addEventListener('change', (e) => {
  const select = e.target;
  const selectedOption = select.options[select.selectedIndex];
  const hint = document.getElementById('stockHint');

  if (selectedOption && selectedOption.dataset.stock) {
    hint.textContent = `该批次剩余库存：${selectedOption.dataset.stock} 件`;
    hint.style.color = '#67c23a';
    document.getElementById('outboundQuantity').max = selectedOption.dataset.stock;
  } else {
    hint.textContent = '';
    document.getElementById('outboundQuantity').max = '';
  }
});

document.getElementById('inboundForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = {
    materialCode: document.getElementById('materialCode').value.trim(),
    batchNo: document.getElementById('batchNo').value.trim(),
    quantity: parseInt(document.getElementById('quantity').value),
    inboundTime: formatDateTimeLocal(document.getElementById('inboundTime').value),
  };

  const resultBox = document.getElementById('inboundResult');
  resultBox.classList.remove('hidden', 'success', 'error');

  try {
    const res = await fetch(`${API_BASE}/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();

    if (data.success) {
      resultBox.classList.add('success');
      resultBox.innerHTML = `
        <div class="result-title">✅ 入库成功</div>
        <div class="result-detail">
          <div>入库单号：<strong>${data.inboundNo}</strong></div>
          <div>物资代号：${escapeHtml(formData.materialCode)}</div>
          <div>批次号：${escapeHtml(formData.batchNo)}</div>
          <div>入库件数：${formData.quantity} 件</div>
          <div>入库时刻：${formData.inboundTime}</div>
        </div>
      `;
      document.getElementById('inboundForm').reset();
      loadBatchList();
      loadDashboardStats();
    } else {
      resultBox.classList.add('error');
      resultBox.innerHTML = `
        <div class="result-title">❌ 入库失败</div>
        <div class="result-detail">${escapeHtml(data.error || '未知错误')}</div>
      `;
    }
  } catch (err) {
    resultBox.classList.add('error');
    resultBox.innerHTML = `
      <div class="result-title">❌ 网络错误</div>
      <div class="result-detail">请稍后重试</div>
    `;
  }
});

document.getElementById('outboundForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const select = document.getElementById('outboundBatch');
  const selectedOption = select.options[select.selectedIndex];

  const formData = {
    batchId: document.getElementById('outboundBatch').value,
    quantity: parseInt(document.getElementById('outboundQuantity').value),
    receiverCode: document.getElementById('receiverCode').value.trim(),
  };

  const resultBox = document.getElementById('outboundResult');
  resultBox.classList.remove('hidden', 'success', 'error');

  try {
    const res = await fetch(`${API_BASE}/outbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();

    if (data.success) {
      resultBox.classList.add('success');
      resultBox.innerHTML = `
        <div class="result-title">✅ 调拨成功</div>
        <div class="result-detail">
          <div>调拨单号：<strong>${data.outboundNo}</strong></div>
          <div>物资代号：${selectedOption ? escapeHtml(selectedOption.dataset.materialCode) : ''}</div>
          <div>批次号：${selectedOption ? escapeHtml(selectedOption.dataset.batchNo) : ''}</div>
          <div>调拨件数：${formData.quantity} 件</div>
          <div>剩余库存：${data.remainingQuantity} 件</div>
          <div>接收单位：${escapeHtml(formData.receiverCode)}</div>
        </div>
      `;
      document.getElementById('outboundForm').reset();
      document.getElementById('stockHint').textContent = '';
      loadAvailableBatches();
      loadBatchList();
      loadDashboardStats();
    } else {
      resultBox.classList.add('error');
      resultBox.innerHTML = `
        <div class="result-title">❌ 调拨失败</div>
        <div class="result-detail">${escapeHtml(data.error || '未知错误')}</div>
      `;
    }
  } catch (err) {
    resultBox.classList.add('error');
    resultBox.innerHTML = `
      <div class="result-title">❌ 网络错误</div>
      <div class="result-detail">请稍后重试</div>
    `;
  }
});

function formatDateTime(timeStr) {
  if (!timeStr) return '-';
  const match = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
  }
  return timeStr;
}

function formatDateTimeLocal(value) {
  if (!value) return '';
  const [datePart, timePart] = value.split('T');
  return `${datePart} ${timePart}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  const localDateTime = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + 'T' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0');
  document.getElementById('inboundTime').value = localDateTime;

  loadDashboardStats();
  loadBatchList();
});
