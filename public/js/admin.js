let deleteTargetId = null;

async function loadShops() {
  const res = await fetch('/api/shops');
  const shops = await res.json();
  const container = document.getElementById('shop-list');
  container.innerHTML = '';

  if (shops.length === 0) {
    container.innerHTML = '<div class="list-item text-center" style="color:#999;padding:40px 16px;">暂无店铺记录</div>';
    return;
  }

  shops.forEach((shop) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-item-title">
        ${escapeHtml(shop.name)}
        <span style="float:right;font-size:12px;color:${shop.status === 'visited' ? '#B0B0B0' : '#07C160'};">
          ${shop.status === 'visited' ? '已去' : '未去'}
        </span>
      </div>
      <div class="list-item-meta">
        ${shop.lat.toFixed(4)}, ${shop.lng.toFixed(4)} · ${formatDate(shop.created_at)}
      </div>
      <div style="margin-top:8px;">
        <button class="btn btn-secondary" style="font-size:13px;padding:4px 12px;" onclick="openDeleteSheet(${shop.id}, '${escapeHtml(shop.name)}')">删除</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function openManualAdd() {
  document.getElementById('manual-add-modal').classList.remove('hidden');
}

function closeManualAdd() {
  document.getElementById('manual-add-modal').classList.add('hidden');
  document.getElementById('manual-name').value = '';
  document.getElementById('manual-lat').value = '';
  document.getElementById('manual-lng').value = '';
}

async function submitManualAdd() {
  const name = document.getElementById('manual-name').value.trim();
  const lat = parseFloat(document.getElementById('manual-lat').value);
  const lng = parseFloat(document.getElementById('manual-lng').value);

  if (!name || isNaN(lat) || isNaN(lng)) {
    alert('请填写完整的店名、纬度和经度');
    return;
  }

  const res = await fetch('/api/shops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, lat, lng }),
  });

  if (res.ok) {
    closeManualAdd();
    loadShops();
  } else {
    alert('添加失败');
  }
}

function openDeleteSheet(id, name) {
  deleteTargetId = id;
  document.getElementById('delete-shop-name').textContent = name;
  document.getElementById('delete-actionsheet').classList.remove('hidden');
}

function closeDeleteSheet() {
  document.getElementById('delete-actionsheet').classList.add('hidden');
  deleteTargetId = null;
}

async function confirmDelete() {
  if (!deleteTargetId) return;

  const res = await fetch(`/api/shops/${deleteTargetId}`, { method: 'DELETE' });
  if (res.ok) {
    closeDeleteSheet();
    loadShops();
  } else {
    alert('删除失败');
  }
}

// Init
loadShops();
