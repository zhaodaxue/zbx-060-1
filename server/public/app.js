const API_BASE = '/api';

const state = {
  batchData: [],
  searchKeyword: '',
  collapsedGroups: new Set(),
  currentPage: 'dashboard',
};

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

document.getElementById('batchSearch').addEventListener('input', (e) => {
  state.searchKeyword = e.target.value.trim().toLowerCase();
  renderBatchList();
});

document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'batchModalOverlay') {
    closeModal();
  }
});

document.getElementById('modalClose').addEventListener('click', closeModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
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
  state.currentPage = pageName;

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
    if (data.success) {
      state.batchData = data.data;
      renderBatchList();
    }
  } catch (err) {
    console.error('加载批次列表失败:', err);
    document.getElementById('batchList').innerHTML = '<div class="loading">加载失败</div>';
  }
}

function renderBatchList() {
  const container = document.getElementById('batchList');
  const keyword = state.searchKeyword;

  if (!state.batchData || state.batchData.length === 0) {
    container.innerHTML = '<div class="loading">暂无批次数据</div>';
    return;
  }

  let html = '';
  let hasVisibleGroup = false;

  for (const group of state.batchData) {
    const groupMatch = keyword === '' || group.materialCode.toLowerCase().includes(keyword);
    const visibleBatches = group.batches.filter(batch => {
      return keyword === '' ||
        group.materialCode.toLowerCase().includes(keyword) ||
        batch.batchNo.toLowerCase().includes(keyword);
    });

    if (visibleBatches.length === 0) {
      continue;
    }

    hasVisibleGroup = true;
    const isCollapsed = state.collapsedGroups.has(group.materialCode);
    const collapseClass = isCollapsed ? 'collapsed' : '';

    html += `
      <div class="material-group ${collapseClass}" data-material="${escapeHtml(group.materialCode)}">
        <div class="material-group-title" data-toggle-material="${escapeHtml(group.materialCode)}">
          <span>${escapeHtml(group.materialCode)}</span>
          <span class="toggle-icon">▼</span>
        </div>
        <div class="batch-items">
    `;

    for (const batch of visibleBatches) {
      const isDepleted = batch.remainingQuantity === 0;
      const statusClass = isDepleted ? 'depleted' : 'available';
      const timeStr = formatDateTime(batch.latestInboundTime);
      html += `
        <div class="batch-item ${statusClass}"
             data-batch-id="${batch.id}"
             data-batch-no="${escapeHtml(batch.batchNo)}"
             data-material-code="${escapeHtml(batch.materialCode)}"
             data-available="${!isDepleted}"
             data-stock="${batch.remainingQuantity}">
          <div class="batch-no">${escapeHtml(batch.batchNo)}</div>
          <div class="batch-info">剩余 ${batch.remainingQuantity} / ${timeStr}</div>
        </div>
      `;
    }

    html += '</div></div>';
  }

  if (!hasVisibleGroup) {
    container.innerHTML = '<div class="no-results">无匹配批次</div>';
  } else {
    container.innerHTML = html;
  }

  bindBatchListEvents();
}

function bindBatchListEvents() {
  document.querySelectorAll('.material-group-title').forEach(title => {
    title.addEventListener('click', (e) => {
      e.stopPropagation();
      const materialCode = title.dataset.toggleMaterial;
      if (state.collapsedGroups.has(materialCode)) {
        state.collapsedGroups.delete(materialCode);
      } else {
        state.collapsedGroups.add(materialCode);
      }
      const group = title.closest('.material-group');
      group.classList.toggle('collapsed');
    });
  });

  document.querySelectorAll('.batch-item').forEach(item => {
    item.addEventListener('click', () => {
      const isAvailable = item.dataset.available === 'true';
      const batchId = item.dataset.batchId;
      const materialCode = item.dataset.materialCode;
      const batchNo = item.dataset.batchNo;
      const stock = parseInt(item.dataset.stock);

      if (isAvailable) {
        selectBatchForOutbound(batchId, materialCode, batchNo, stock);
      } else {
        showBatchDetail(batchId, materialCode, batchNo);
      }
    });
  });
}

function selectBatchForOutbound(batchId, materialCode, batchNo, stock) {
  if (state.currentPage !== 'outbound') {
    switchPage('outbound');
  }

  const select = document.getElementById('outboundBatch');
  const options = select.querySelectorAll('option');

  let found = false;
  for (const opt of options) {
    if (opt.value === batchId) {
      opt.selected = true;
      found = true;
      break;
    }
  }

  if (!found) {
    const newOption = document.createElement('option');
    newOption.value = batchId;
    newOption.textContent = `${materialCode} / ${batchNo} (剩余: ${stock}件)`;
    newOption.dataset.stock = stock;
    newOption.dataset.batchNo = batchNo;
    newOption.dataset.materialCode = materialCode;
    newOption.selected = true;
    select.appendChild(newOption);
  }

  const hint = document.getElementById('stockHint');
  hint.textContent = `该批次剩余库存：${stock} 件`;
  hint.style.color = '#67c23a';
  document.getElementById('outboundQuantity').max = stock;

  const quantityInput = document.getElementById('outboundQuantity');
  if (quantityInput.value && parseInt(quantityInput.value) > stock) {
    quantityInput.value = '';
  }
  setTimeout(() => {
    quantityInput.focus();
  }, 100);
}

async function showBatchDetail(batchId, materialCode, batchNo) {
  const modalOverlay = document.getElementById('batchModalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  modalTitle.textContent = `${materialCode} / ${batchNo} - 最近调拨`;
  modalBody.innerHTML = '<div class="loading">加载中...</div>';
  modalOverlay.classList.remove('hidden');

  try {
    const res = await fetch(`${API_BASE}/batches/${batchId}/latest-outbound`);
    const data = await res.json();

    if (data.success && data.data) {
      const d = data.data;
      modalBody.innerHTML = `
        <div class="modal-detail">
          <div class="detail-row">
            <span class="detail-label">调拨单号</span>
            <span class="detail-value"><strong>${escapeHtml(d.outboundNo)}</strong></span>
          </div>
          <div class="detail-row">
            <span class="detail-label">接收单位</span>
            <span class="detail-value">${escapeHtml(d.receiverCode)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">调拨件数</span>
            <span class="detail-value">${d.quantity} 件</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">出库时刻</span>
            <span class="detail-value">${formatDateTime(d.outboundTime)}</span>
          </div>
        </div>
      `;
    } else {
      modalBody.innerHTML = '<div class="modal-empty">该批次暂无调拨记录</div>';
    }
  } catch (err) {
    console.error('加载批次详情失败:', err);
    modalBody.innerHTML = '<div class="modal-empty">加载失败，请稍后重试</div>';
  }
}

function closeModal() {
  document.getElementById('batchModalOverlay').classList.add('hidden');
}

async function loadAvailableBatches() {
  try {
    const res = await fetch(`${API_BASE}/batches/available`);
    const data = await res.json();
    const select = document.getElementById('outboundBatch');
    const currentValue = select.value;

    select.innerHTML = '<option value="">请选择批次（仅显示有库存的）</option>';

    if (data.success && data.data.length > 0) {
      for (const batch of data.data) {
        const option = document.createElement('option');
        option.value = batch.id;
        option.textContent = `${batch.materialCode} / ${batch.batchNo} (剩余: ${batch.remainingQuantity}件)`;
        option.dataset.stock = batch.remainingQuantity;
        option.dataset.batchNo = batch.batchNo;
        option.dataset.materialCode = batch.materialCode;
        if (batch.id === currentValue) {
          option.selected = true;
        }
        select.appendChild(option);
      }
    }

    if (currentValue) {
      const selectedOption = select.options[select.selectedIndex];
      if (selectedOption && selectedOption.dataset.stock) {
        const hint = document.getElementById('stockHint');
        hint.textContent = `该批次剩余库存：${selectedOption.dataset.stock} 件`;
        hint.style.color = '#67c23a';
        document.getElementById('outboundQuantity').max = selectedOption.dataset.stock;
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
