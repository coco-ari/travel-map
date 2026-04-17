// ===== Map Initialization =====
const map = L.map('map-container', {
  zoomControl: false,
}).setView([22.5428, 113.9442], 12); // 深圳默认

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
  maxZoom: 19,
}).addTo(map);

// ===== State =====
let userLat = null;
let userLng = null;
let userMarker = null;
let shopMarkers = {};
let showAll = false;
let activeTag = 'all';
let searchQuery = '';
let allShops = [];

// ===== Location =====
function initLocation() {
  if (!navigator.geolocation) {
    alert('您的浏览器不支持定位功能');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      map.setView([userLat, userLng], 15);
      addLocationMarker(userLat, userLng);
      loadShops();
    },
    (err) => {
      console.error('定位失败:', err);
      const msg = err.code === 1 ? '未允许定位权限，请在浏览器设置中开启'
        : err.code === 2 ? '无法获取位置信息'
        : '定位超时，请检查网络连接后重试';
      alert(msg);
      loadShops(); // Load anyway without location
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function addLocationMarker(lat, lng) {
  if (userMarker) userMarker.setLatLng([lat, lng]);

  const icon = L.divIcon({
    className: 'location-pin',
    html: `<div style="
      width: 16px; height: 16px;
      background: #4A90D9;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(74,144,217,0.3);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  userMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
}

// ===== Shop Loading =====
async function loadShops() {
  const url = showAll ? '/api/shops' : '/api/shops?status=unvisited';
  const res = await fetch(url);
  allShops = await res.json();
  renderMarkers();
}

function renderMarkers() {
  // Clear existing shop markers
  Object.values(shopMarkers).forEach((m) => map.removeLayer(m));
  shopMarkers = {};

  let shops = allShops;

  // Filter by search
  if (searchQuery) {
    shops = shops.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  // Filter by tag
  if (activeTag !== 'all') {
    shops = shops.filter(s => s.tags && s.tags.split(',').includes(activeTag));
  }

  // Sort by distance when showAll is on
  if (showAll && userLat && userLng) {
    shops = shops.slice().sort((a, b) => {
      const da = getDistance(userLat, userLng, a.lat, a.lng);
      const db2 = getDistance(userLat, userLng, b.lat, b.lng);
      return da - db2;
    });
  }

  shops.forEach((shop) => addShopMarker(shop));
}

function addShopMarker(shop) {
  if (shopMarkers[shop.id]) return;

  const isVisited = shop.status === 'visited';
  const dist = getDistance(userLat, userLng, shop.lat, shop.lng);
  const markerColor = isVisited ? '#B0B0B0' : (dist <= 2000 ? '#FF9F00' : '#07C160');
  const scale = isVisited ? 0.7 : (dist <= 2000 ? 1.2 : 1);

  const icon = L.divIcon({
    className: 'shop-pin',
    html: `
      <div class="shop-marker-wrapper" style="transform:scale(${scale});transform-origin:center bottom;">
        <svg class="shop-marker-icon" width="24" height="34" viewBox="0 0 24 34">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20C24 5.373 18.627 0 12 0z"
                fill="${markerColor}" stroke="#fff" stroke-width="1.5"/>
          <circle cx="12" cy="11" r="5" fill="#fff" fill-opacity="0.9"/>
        </svg>
        <div class="shop-marker-label">${escapeHtml(shop.name)}</div>
      </div>
    `,
    iconSize: [120, 60],
    iconAnchor: [60, 34],
  });

  const marker = L.marker([shop.lat, shop.lng], { icon }).addTo(map);
  marker._shopStatus = shop.status === 'visited' ? '已去' : '未去';
  marker._shopData = shop;
  marker.bindPopup(createShopPopup(shop));
  shopMarkers[shop.id] = marker;
}

function formatDistance(meters) {
  if (meters == null || !isFinite(meters)) return '';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function createShopPopup(shop) {
  const popup = document.createElement('div');
  popup.className = 'shop-popup';
  const dist = getDistance(userLat, userLng, shop.lat, shop.lng);
  const distStr = formatDistance(dist);

  popup.innerHTML = `
    <div class="shop-popup-name">${escapeHtml(shop.name)}</div>
    ${distStr ? `<div class="shop-popup-dist">${distStr}</div>` : ''}
    <div class="shop-popup-actions">
      <button class="btn btn-primary btn-sm" data-action="markVisited" data-id="${shop.id}">已吃</button>
      <button class="btn btn-secondary btn-sm" data-action="showDetail" data-id="${shop.id}">详情</button>
      <button class="btn btn-secondary btn-sm" data-action="navigateTo" data-lat="${shop.lat}" data-lng="${shop.lng}">导航</button>
    </div>
  `;

  popup.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'markVisited') markVisited(Number(btn.dataset.id));
    else if (action === 'showDetail') showDetail(Number(btn.dataset.id));
    else if (action === 'navigateTo') navigateTo(Number(btn.dataset.lat), Number(btn.dataset.lng));
  });

  return popup;
}

// ===== Distance (Haversine) =====
function getDistance(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null) return Infinity;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Toggle Show All =====
window.toggleShowAll = async function() {
  showAll = !showAll;
  await loadShops();
};

// ===== Search =====
const searchInput = document.getElementById('search-input');
if (searchInput) {
  let searchTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = e.target.value.trim();
      renderMarkers();
    }, 300);
  });
}

// ===== Tag Filter =====
document.getElementById('tag-bar')?.addEventListener('click', (e) => {
  const tag = e.target.closest('.tag');
  if (!tag) return;
  document.querySelectorAll('.tag').forEach(t => t.classList.remove('tag-active'));
  tag.classList.add('tag-active');
  activeTag = tag.dataset.tag;
  renderMarkers();
});

// ===== Public API =====
window.markVisited = async function(id) {
  await fetch(`/api/shops/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'visited' }),
  });
  if (shopMarkers[id]) {
    map.removeLayer(shopMarkers[id]);
    delete shopMarkers[id];
  }
  map.closePopup();
};

window.showDetail = async function(id) {
  const marker = shopMarkers[id];
  if (!marker) return;
  const shop = marker._shopData;
  const { lat, lng } = marker.getLatLng();
  const dist = getDistance(userLat, userLng, lat, lng);
  const distStr = formatDistance(dist);

  // Fetch photos
  let photos = [];
  try {
    const res = await fetch(`/api/shops/${id}/photos`);
    if (res.ok) photos = await res.json();
  } catch {}

  const statusText = marker._shopStatus || '未去';
  const rating = shop?.rating || 0;

  const detail = document.createElement('div');
  detail.className = 'modal-overlay';
  detail.id = 'shop-detail-modal';
  detail.innerHTML = `
    <div class="modal shop-detail-modal">
      <div class="modal-header">店铺详情</div>
      <div class="modal-body">
        <div style="margin-bottom:8px;"><strong>店名：</strong>${escapeHtml(shop?.name || '未知')}</div>
        <div style="margin-bottom:8px;"><strong>坐标：</strong>${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
        ${distStr ? `<div style="margin-bottom:8px;"><strong>距离：</strong>${distStr}</div>` : ''}
        <div style="margin-bottom:12px;"><strong>状态：</strong>${statusText}</div>
        <div class="rating-section">
          <strong>评分：</strong>
          <div class="stars" data-shop-id="${id}" data-rating="${rating}">
            ${[1,2,3,4,5].map(i => `<span class="star${i <= rating ? ' star-active' : ''}" data-value="${i}">★</span>`).join('')}
          </div>
        </div>
        <div class="notes-section" style="margin-top:8px;">
          <textarea id="shop-notes" class="notes-input" placeholder="添加备注..." maxlength="200">${escapeHtml(shop?.notes || '')}</textarea>
        </div>
        <div class="photo-section">
          <div class="photo-grid" id="photo-grid">
            ${photos.map(p => `
              <div class="photo-thumb" data-id="${p.id}" onclick="previewPhoto('${p.filename}', ${p.id})">
                <img src="/photos/${p.filename}" alt="店铺照片">
              </div>
            `).join('')}
          </div>
          ${photos.length === 0 ? '<div class="no-photos">暂无照片</div>' : ''}
        </div>
        <div class="photo-actions">
          <label class="photo-upload-btn">
            📷 拍照上传
            <input type="file" accept="image/*" capture="environment" id="photo-input" onchange="uploadPhoto(${id}, this)" hidden>
          </label>
          <button class="btn btn-secondary btn-sm" id="save-notes-btn" style="margin-left:8px;">保存备注</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="document.getElementById('shop-detail-modal').remove()">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(detail);

  // Star rating events
  detail.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      const value = Number(star.dataset.value);
      const starsContainer = star.parentElement;
      starsContainer.dataset.rating = value;
      starsContainer.querySelectorAll('.star').forEach((s, i) => {
        s.classList.toggle('star-active', i < value);
      });
    });
  });

  // Save notes/rating
  detail.querySelector('#save-notes-btn').addEventListener('click', async () => {
    const notes = detail.querySelector('#shop-notes').value.trim();
    const rating = Number(detail.querySelector('.stars').dataset.rating);
    await fetch(`/api/shops/${id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, rating }),
    });
    alert('已保存');
  });
};

window.previewPhoto = function(filename, photoId) {
  const overlay = document.createElement('div');
  overlay.className = 'photo-preview-overlay';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `
    <img src="/photos/${filename}" alt="照片预览">
    <button class="btn btn-danger photo-delete-btn" onclick="event.stopPropagation(); deletePhoto(${photoId}, this)">删除</button>
  `;
  document.body.appendChild(overlay);
};

window.uploadPhoto = async function(shopId, input) {
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('photo', file);

  try {
    const res = await fetch(`/api/shops/${shopId}/photo`, {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      document.getElementById('shop-detail-modal')?.remove();
      showDetail(shopId);
    } else {
      const err = await res.json();
      alert(err.error || '上传失败');
    }
  } catch {
    alert('上传失败，请重试');
  }
};

window.deletePhoto = async function(photoId, btn) {
  if (!confirm('确定删除此照片吗？')) return;
  try {
    const res = await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
    if (res.ok) {
      document.querySelector('.photo-preview-overlay')?.remove();
      const modal = document.getElementById('shop-detail-modal');
      if (modal) {
        const shopId = document.getElementById('photo-input')?.getAttribute('onchange')?.match(/\d+/)?.[0];
        modal.remove();
        if (shopId) showDetail(Number(shopId));
      }
    }
  } catch {
    alert('删除失败');
  }
};

window.navigateTo = function(lat, lng) {
  if (userLat && userLng) {
    window.location.href = `amapuri://route/plan/?slat=${encodeURIComponent(userLat)}&slon=${encodeURIComponent(userLng)}&dlat=${encodeURIComponent(lat)}&dlon=${encodeURIComponent(lng)}&dev=0`;
  } else {
    window.open(`https://uri.amap.com/marker?position=${encodeURIComponent(lng)},${encodeURIComponent(lat)}`);
  }
};

// ===== Add Shop Mode =====
let pendingMarker = null;
let pendingLat = null;
let pendingLng = null;

function startAddShop(lat, lng) {
  const hint = document.getElementById('longpress-hint');
  if (hint) hint.style.opacity = '0';

  if (pendingMarker) {
    map.removeLayer(pendingMarker);
    pendingMarker = null;
  }
  pendingLat = lat;
  pendingLng = lng;

  const icon = L.divIcon({
    className: 'temp-pin',
    html: `<div style="
      width: 20px; height: 20px;
      background: #FF9F00;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(255,159,0,0.3);
      animation: pulse 1s infinite;
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    draggable: true,
  });

  pendingMarker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);

  pendingMarker.on('dragend', (e) => {
    const pos = e.target.getLatLng();
    pendingLat = pos.lat;
    pendingLng = pos.lng;
  });

  showAddModal();
}

function showAddModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'add-shop-modal';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">添加店铺</div>
      <div class="modal-body">
        <input id="add-shop-name" class="input" placeholder="请输入店名" maxlength="100">
        <div style="margin-top:8px;font-size:12px;color:#999;">
          坐标: ${pendingLat.toFixed(4)}, ${pendingLng.toFixed(4)}
          <span style="color:#999;font-size:11px;">（可在地图上拖动标记调整位置）</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="add-cancel-btn">取消</button>
        <button class="btn btn-confirm" id="add-confirm-btn">确定</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#add-cancel-btn').addEventListener('click', cancelAddShop);
  modal.querySelector('#add-confirm-btn').addEventListener('click', confirmAddShop);

  setTimeout(() => {
    const input = document.getElementById('add-shop-name');
    if (input) input.focus();
  }, 300);

  document.getElementById('add-shop-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmAddShop();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) cancelAddShop();
  });
}

function cancelAddShop() {
  const modal = document.getElementById('add-shop-modal');
  if (modal) modal.remove();
  if (pendingMarker) {
    map.removeLayer(pendingMarker);
    pendingMarker = null;
  }
  pendingLat = null;
  pendingLng = null;
}

async function confirmAddShop() {
  const name = document.getElementById('add-shop-name').value.trim();
  if (!name) {
    alert('请输入店名');
    return;
  }

  const res = await fetch('/api/shops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, lat: pendingLat, lng: pendingLng }),
  });

  if (res.ok) {
    const shop = await res.json();
    addShopMarker(shop);
    const modal = document.getElementById('add-shop-modal');
    if (modal) modal.remove();
    if (pendingMarker) {
      map.removeLayer(pendingMarker);
      pendingMarker = null;
    }
    pendingLat = null;
    pendingLng = null;
  } else {
    alert('添加失败，请重试');
  }
}

// Long press detection
let longPressTimer = null;
let touchStartPos = null;
const LONG_PRESS_DURATION = 500;
const MOVE_THRESHOLD = 10;

map.on('touchstart', (e) => {
  if (pendingMarker) return;
  const touch = e.originalEvent.touches[0];
  if (!touch) return;
  touchStartPos = { x: touch.screenX, y: touch.screenY };

  longPressTimer = setTimeout(() => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    startAddShop(lat, lng);
  }, LONG_PRESS_DURATION);
});

map.on('touchmove', (e) => {
  if (!touchStartPos) return;
  const touch = e.originalEvent.touches[0];
  if (!touch) return;
  const dx = Math.abs(touch.screenX - touchStartPos.x);
  const dy = Math.abs(touch.screenY - touchStartPos.y);
  if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }
});

map.on('touchend', () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  touchStartPos = null;
});

map.on('contextmenu', (e) => {
  e.originalEvent.preventDefault();
  if (!pendingMarker) {
    startAddShop(e.latlng.lat, e.latlng.lng);
  }
});

map.on('mousedown', (e) => {
  if (pendingMarker) return;
  longPressTimer = setTimeout(() => {
    startAddShop(e.latlng.lat, e.latlng.lng);
  }, LONG_PRESS_DURATION);
});

map.on('mouseup mousemove', () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
});

// ===== Init =====
initLocation();
