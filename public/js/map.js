// ===== Map Initialization =====
const map = L.map('map-container', {
  zoomControl: false,
}).setView([39.9042, 116.4074], 15); // 北京默认

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
  maxZoom: 19,
}).addTo(map);

// ===== State =====
let userLat = null;
let userLng = null;
let userMarker = null;
let shopMarkers = {};

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
  const res = await fetch('/api/shops?status=unvisited');
  const shops = await res.json();
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
  marker.bindPopup(createShopPopup(shop));
  shopMarkers[shop.id] = marker;
}

function createShopPopup(shop) {
  const popup = document.createElement('div');
  popup.className = 'shop-popup';
  // Use JSON.stringify for numeric values to prevent XSS in inline onclick
  popup.innerHTML = `
    <div class="shop-popup-name">${escapeHtml(shop.name)}</div>
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

let showAll = false;

window.toggleShowAll = async function() {
  showAll = !showAll;
  // Clear existing shop markers
  Object.values(shopMarkers).forEach((m) => map.removeLayer(m));
  shopMarkers = {};

  // Reload markers with new filter
  const res = await fetch(showAll ? '/api/shops' : '/api/shops?status=unvisited');
  const shops = await res.json();
  shops.forEach((shop) => addShopMarker(shop));
};

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

window.showDetail = function(id) {
  const marker = shopMarkers[id];
  if (!marker) return;
  const { lat, lng } = marker.getLatLng();
  // Get name from popup element's raw text (textContent already unescapes HTML entities)
  const popupEl = marker.getPopup().getElement();
  const nameEl = popupEl.querySelector('.shop-popup-name');
  const name = nameEl ? nameEl.textContent : '未知';

  const detail = document.createElement('div');
  detail.className = 'modal-overlay';
  detail.innerHTML = `
    <div class="modal">
      <div class="modal-header">店铺详情</div>
      <div class="modal-body">
        <div style="margin-bottom:8px;"><strong>店名：</strong>${escapeHtml(name)}</div>
        <div style="margin-bottom:8px;"><strong>坐标：</strong>${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
        <div><strong>状态：</strong>未去</div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(detail);
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
  // Hide hint
  const hint = document.getElementById('longpress-hint');
  if (hint) hint.style.opacity = '0';

  // Remove existing pending marker
  if (pendingMarker) {
    map.removeLayer(pendingMarker);
    pendingMarker = null;
  }
  pendingLat = lat;
  pendingLng = lng;

  // Create draggable temp marker (orange, pulsing)
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

  // Update position when dragged
  pendingMarker.on('dragend', (e) => {
    const pos = e.target.getLatLng();
    pendingLat = pos.lat;
    pendingLng = pos.lng;
  });

  // Show input modal
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

  // Event listeners
  modal.querySelector('#add-cancel-btn').addEventListener('click', cancelAddShop);
  modal.querySelector('#add-confirm-btn').addEventListener('click', confirmAddShop);

  // Auto-focus input
  setTimeout(() => {
    const input = document.getElementById('add-shop-name');
    if (input) input.focus();
  }, 300);

  // Enter key to confirm
  document.getElementById('add-shop-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmAddShop();
  });

  // Tap overlay to cancel
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
    // Close modal
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
const LONG_PRESS_DURATION = 500; // 500ms

map.on('touchstart', (e) => {
  if (pendingMarker) return; // Don't trigger if already in add mode
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  longPressTimer = setTimeout(() => {
    startAddShop(lat, lng);
  }, LONG_PRESS_DURATION);
});

map.on('touchmove', () => {
  // Cancel long press if user drags the map
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
});

map.on('touchend', () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
});

// Mouse fallback for desktop testing
map.on('mousedown', (e) => {
  if (pendingMarker) return;
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  longPressTimer = setTimeout(() => {
    startAddShop(lat, lng);
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
