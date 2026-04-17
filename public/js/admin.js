let deleteTargetId = null;
let allShops = [];
let userLat = null;
let userLng = null;
let adminDistanceFilter = 0; // 0 = all

function getDistance(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null) return Infinity;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function loadShops() {
  const res = await fetch('/api/shops');
  allShops = await res.json();
  renderShops();
}

function renderShops() {
  const container = document.getElementById('shop-list');
  container.innerHTML = '';

  let shops = [...allShops];

  // Filter by distance
  if (adminDistanceFilter > 0 && userLat && userLng) {
    shops = shops.filter(s => getDistance(userLat, userLng, s.lat, s.lng) <= adminDistanceFilter);
    shops.sort((a, b) => getDistance(userLat, userLng, a.lat, a.lng) - getDistance(userLat, userLng, b.lat, b.lng));
  }

  if (shops.length === 0) {
    container.innerHTML = '<div class="list-item text-center" style="color:#999;padding:40px 16px;">暂无店铺记录</div>';
    return;
  }

  shops.forEach((shop) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    const dist = getDistance(userLat, userLng, shop.lat, shop.lng);
    const distStr = dist < Infinity ? (dist < 1000 ? Math.round(dist) + 'm' : (dist / 1000).toFixed(1) + 'km') : '';
    item.innerHTML = `
      <div class="list-item-title">
        ${escapeHtml(shop.name)}
        <span style="float:right;font-size:12px;color:${shop.status === 'visited' ? '#B0B0B0' : '#07C160'};">
          ${shop.status === 'visited' ? '已去' : '未去'}
          ${distStr ? ' · ' + distStr : ''}
        </span>
      </div>
      <div class="list-item-meta">
        ${shop.lat.toFixed(4)}, ${shop.lng.toFixed(4)} · ${formatDate(shop.created_at)}
      </div>
      <div style="margin-top:8px;">
        <button class="btn btn-secondary btn-delete" style="font-size:13px;padding:4px 12px;" data-id="${shop.id}" data-name="${escapeHtml(shop.name)}">删除</button>
      </div>
    `;
    item.querySelector('.btn-delete').addEventListener('click', () => {
      openDeleteSheet(Number(shop.id), shop.name);
    });
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
    // Notify map page to refresh
    const bc = new BroadcastChannel('travel-map-sync');
    bc.postMessage({ action: 'shop-deleted', id: deleteTargetId });
    bc.close();

    closeDeleteSheet();
    loadShops();
  } else {
    alert('删除失败');
  }
}

// Distance filter pills
document.querySelectorAll('.dist-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    adminDistanceFilter = Number(pill.dataset.dist);
    document.querySelectorAll('.dist-pill').forEach(p => p.classList.remove('dist-pill-active'));
    pill.classList.add('dist-pill-active');
    renderShops();
  });
});

// Get user location for distance filtering
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => { userLat = pos.coords.latitude; userLng = pos.coords.longitude; },
    () => {},
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
  );
}

// Init
loadShops();
