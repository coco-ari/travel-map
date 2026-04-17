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
      alert('无法获取您的位置，请允许定位权限');
    },
    { enableHighAccuracy: true }
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
  const markerSize = isVisited ? 8 : (dist <= 2000 ? 14 : 10);

  const icon = L.divIcon({
    className: 'shop-pin',
    html: `<div style="
      width: ${markerSize}px; height: ${markerSize}px;
      background: ${markerColor};
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [markerSize, markerSize],
    iconAnchor: [markerSize / 2, markerSize / 2],
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
let addMode = false;

window.toggleAddMode = function() {
  addMode = !addMode;
  document.getElementById('add-btn').textContent = addMode ? '取消' : '添加';
  document.getElementById('add-btn').classList.toggle('btn-primary', !addMode);
  document.getElementById('add-btn').classList.toggle('btn-danger', addMode);
  map.getContainer().style.cursor = addMode ? 'crosshair' : '';
};

map.on('click', async (e) => {
  if (!addMode) return;

  const name = prompt('请输入店名:');
  if (!name) return;

  const res = await fetch('/api/shops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, lat: e.latlng.lat, lng: e.latlng.lng }),
  });

  if (res.ok) {
    const shop = await res.json();
    addShopMarker(shop);
    toggleAddMode();
  }
});

// ===== Init =====
initLocation();
