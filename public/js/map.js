// ===== Map Initialization =====
let map = null;
let mapInitialized = false;

function initMap() {
  if (mapInitialized) return;
  map = L.map('map-container', { zoomControl: false }).setView([22.5428, 113.9442], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);
  mapInitialized = true;
  map.invalidateSize();
}

// ===== State =====
let userLat = null;
let userLng = null;
let userMarker = null;
let shopMarkers = {};
let allShops = [];
let photoCache = {}; // Cache photos by shop id to avoid re-fetching
let currentView = 'map'; // 'card' or 'map' — default to map
let distanceFilter = 5; // Default 5km for card view, options: 1, 3, 5, 10

// ===== Card Pagination =====
const CARD_PAGE_SIZE = 20;
let cardPage = 0;
let cardFilteredShops = [];
let cardLoading = false;
let cardHasMore = false;

// ===== Food emoji mapping =====
function getFoodEmoji(name) {
  const rules = [
    [/火锅|牛肉火锅|重庆火锅/, '🍲'],
    [/椰子鸡/, '🥥'],
    [/湘菜|辣椒炒肉|笨萝卜|浏阳蒸菜/, '🌶️'],
    [/点都德|陶陶居|蔡澜|港式点心/, '🥟'],
    [/烧烤/, '🍢'],
    [/客家菜/, '🍚'],
    [/西贝莜面村/, '🍜'],
    [/酸菜鱼/, '🐟'],
    [/茶餐厅|港式/, '🍵'],
    [/莆田/, '🦐'],
    [/桂满陇/, '🏮'],
    [/南京大牌档/, '🫕'],
    [/海底捞/, '🥘'],
    [/喜茶/, '🧋'],
    [/探鱼/, '🐠'],
    [/胜记|翠园|炳胜/, '🥢'],
    [/凑凑/, '🍲'],
    [/怂重庆/, '🔥'],
    [/文和友/, '🏪'],
    [/左庭右院/, '🥩'],
    [/农耕记/, '🌾'],
    [/费大厨/, '🍳'],
    [/甘棠/, '🫖'],
    [/利宝阁|半岛|嘉味/, '🍽️'],
  ];
  for (const [re, emoji] of rules) {
    if (re.test(name)) return emoji;
  }
  return '🍴';
}

// ===== Location =====
function initLocation() {
  if (!navigator.geolocation) {
    loadShops();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      if (mapInitialized) map.setView([userLat, userLng], 15);
      addLocationMarker(userLat, userLng);
      loadShops();
    },
    () => { loadShops(); },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function addLocationMarker(lat, lng) {
  if (userMarker) userMarker.setLatLng([lat, lng]);
  const icon = L.divIcon({
    className: 'location-pin',
    html: `<div style="width:16px;height:16px;background:#4A90D9;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 2px rgba(74,144,217,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  userMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
}

// ===== Shop Loading =====
async function loadShops() {
  const q = document.getElementById('search-input')?.value?.trim() || '';
  let url = q ? `/api/shops?search=${encodeURIComponent(q)}&status=all` : '/api/shops';

  const res = await fetch(url);
  allShops = await res.json();
  renderCards();
  if (currentView === 'map') renderMarkers();
}

function formatDistance(meters) {
  if (meters == null || !isFinite(meters)) return '';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function getDistance(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null) return Infinity;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Card View =====
function renderCards(reset) {
  const container = document.getElementById('card-list');
  const empty = document.getElementById('card-empty');

  // Filter and sort by distance
  let shops = [...allShops];
  if (userLat && userLng && distanceFilter > 0) {
    shops = shops.filter(s => getDistance(userLat, userLng, s.lat, s.lng) <= distanceFilter * 1000);
    shops.sort((a, b) => getDistance(userLat, userLng, a.lat, a.lng) - getDistance(userLat, userLng, b.lat, b.lng));
  } else if (userLat && userLng) {
    shops.sort((a, b) => getDistance(userLat, userLng, a.lat, a.lng) - getDistance(userLat, userLng, b.lat, b.lng));
  }
  cardFilteredShops = shops;

  if (shops.length === 0) {
    container.innerHTML = '';
    container.classList.add('hidden');
    empty.classList.remove('hidden');
    empty.innerHTML = `
      <span class="card-empty-icon">🔍</span>
      <div class="card-empty-text">没有找到相关店铺</div>
      <div class="card-empty-sub">试试其他关键词或切换显示全部</div>
    `;
    return;
  }

  container.classList.remove('hidden');
  empty.classList.add('hidden');

  // Clear only on reset/initial render
  if (reset || reset === undefined) {
    cardPage = 0;
    container.innerHTML = '';
  }

  const start = cardPage * CARD_PAGE_SIZE;
  const end = Math.min(start + CARD_PAGE_SIZE, shops.length);
  cardHasMore = end < shops.length;

  for (let i = start; i < end; i++) {
    const shop = shops[i];
    const dist = getDistance(userLat, userLng, shop.lat, shop.lng);
    const distStr = formatDistance(dist);
    const emoji = getFoodEmoji(shop.name);
    const tag = shop.tags ? shop.tags.split(',')[0] : '';
    const rating = shop.rating || 0;
    const hasCover = shop.cover_photo;

    const card = document.createElement('div');
    card.className = `shop-card${hasCover ? ' has-cover' : ''}`;
    card.dataset.id = shop.id;
    card.style.animationDelay = '0s';
    card.innerHTML = `
      <div class="card-image">
        <div class="card-image-bg"></div>
        ${hasCover ? `<img class="card-cover-img" src="${shop.cover_photo}" alt="" loading="lazy">` : ''}
        <span class="card-image-emoji">${emoji}</span>
        <span class="card-status-dot ${shop.status === 'visited' ? 'visited' : 'unvisited'}"></span>
        ${rating > 0 ? `<span class="card-rating">★ ${rating}</span>` : ''}
      </div>
      <div class="card-body">
        <div class="card-name">${escapeHtml(shop.name)}</div>
        <div class="card-footer">
          ${distStr ? `<span class="card-dist">📍 ${distStr}</span>` : '<span></span>'}
          ${tag ? `<span class="card-tag">${escapeHtml(tag)}</span>` : ''}
        </div>
      </div>
    `;

    const cardImage = card.querySelector('.card-image');
    cardImage.setAttribute('data-type', tag || 'default');

    card.addEventListener('click', () => openShopCard(shop));
    container.appendChild(card);
  }

  // Scroll sentinel for infinite scroll
  if (cardHasMore) {
    let sentinel = container.querySelector('.scroll-sentinel');
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.className = 'scroll-sentinel';
    }
    // Always move sentinel to end so it stays at the bottom
    container.appendChild(sentinel);
    setupScrollSentinel(sentinel);
  } else {
    const sentinel = container.querySelector('.scroll-sentinel');
    if (sentinel) sentinel.remove();
  }

  setupCardParallax();
}

// ===== Infinite Scroll Sentinel =====
let scrollObserver = null;

function setupScrollSentinel(el) {
  if (scrollObserver) scrollObserver.disconnect();

  scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !cardLoading && cardHasMore) {
      loadMoreCards();
    }
  }, { root: document.getElementById('card-view'), rootMargin: '200px' });

  scrollObserver.observe(el);
}

async function loadMoreCards() {
  if (cardLoading || !cardHasMore) return;
  cardLoading = true;
  cardPage++;
  renderCards(false);
  cardLoading = false;
}

// ===== Parallax Scroll Effect =====
let parallaxTicking = false;

function setupCardParallax() {
  const container = document.getElementById('card-view');
  if (!container) return;

  container.removeEventListener('scroll', handleCardScroll);
  container.addEventListener('scroll', handleCardScroll, { passive: true });
}

function handleCardScroll() {
  if (parallaxTicking) return;
  parallaxTicking = true;
  requestAnimationFrame(() => {
    const container = document.getElementById('card-view');
    if (!container) { parallaxTicking = false; return; }

    const scrollTop = container.scrollTop;
    const cards = container.querySelectorAll('.shop-card');

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const cardTop = rect.top;
      const cardHeight = rect.height;
      const viewHeight = window.innerHeight;

      // Only apply to cards in viewport
      if (cardTop > viewHeight || cardTop + cardHeight < 0) return;

      // Calculate parallax offset (subtle)
      const progress = (viewHeight - cardTop) / (viewHeight + cardHeight);
      const emoji = card.querySelector('.card-image-emoji');
      if (emoji) {
        const translateY = (progress - 0.5) * 6;
        emoji.style.transform = `translateY(${translateY}px)`;
      }
    });

    parallaxTicking = false;
  });
}

async function openShopCard(shop) {
  // Use local data - no server fetch needed
  const idx = allShops.findIndex(s => s.id === shop.id);
  const currentShop = idx !== -1 ? allShops[idx] : shop;

  const detail = document.createElement('div');
  detail.className = 'modal-overlay';
  detail.id = 'shop-detail-modal';
  const dist = getDistance(userLat, userLng, currentShop.lat, currentShop.lng);
  const distStr = formatDistance(dist);

  // Lazy-load photos from cache or fetch
  let photos = photoCache[shop.id] || null;
  if (!photos) {
    try {
      const res = await fetch(`/api/shops/${shop.id}/photos`);
      if (res.ok) {
        photos = await res.json();
        photoCache[shop.id] = photos;
      } else {
        photos = [];
      }
    } catch {
      photos = [];
    }
  }

  detail.innerHTML = `
    <div class="modal">
      <div class="modal-header">${escapeHtml(currentShop.name)}</div>
      <div class="modal-body">
        <div class="detail-info">
          <div class="detail-info-row">
            <span class="detail-info-label">距离</span>
            <span class="detail-info-value">${distStr || '—'}</span>
          </div>
          <div class="detail-info-row">
            <span class="detail-info-label">状态</span>
            <button class="detail-status-btn" data-action="toggleStatus" data-id="${currentShop.id}">
              <span class="detail-status-text">${currentShop.status === 'visited' ? '已探' : '未探'}</span>
              <span class="detail-status-arrow">›</span>
            </button>
          </div>
          ${currentShop.tags ? `<div class="detail-info-row">
            <span class="detail-info-label">标签</span>
            <span class="detail-info-value">${currentShop.tags.split(',').filter(Boolean).map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join(' ')}</span>
          </div>` : ''}
        </div>
        <div class="rating-section">
          <strong>评分：</strong>
          <div class="stars" data-shop-id="${currentShop.id}" data-rating="${currentShop.rating || 0}">
            ${[1,2,3,4,5].map(i => `<span class="star${i <= (currentShop.rating || 0) ? ' star-active' : ''}" data-value="${i}">★</span>`).join('')}
          </div>
        </div>
        <div class="notes-section">
          <textarea id="shop-notes" class="notes-input" placeholder="添加备注..." maxlength="200">${escapeHtml(currentShop.notes || '')}</textarea>
        </div>
        ${photos.length > 0 ? `
        <div class="photo-section">
          <div class="photo-grid">
            ${photos.map(p => {
              const photoUrl = p.url || `/photos/${p.filename}`;
              return `<div class="photo-thumb" onclick="previewPhoto('${photoUrl}', ${p.id})"><img src="${photoUrl}" alt="店铺照片"></div>`;
            }).join('')}
          </div>
        </div>` : '<div class="no-photos">暂无照片</div>'}
      </div>
      <div class="detail-actions">
        <label class="detail-action-btn photo-btn">
          📷 拍照
          <input type="file" accept="image/*" capture="environment" onchange="uploadPhoto(${currentShop.id}, this)" hidden>
        </label>
        <button class="detail-action-btn" data-action="navigateTo" data-lat="${currentShop.lat}" data-lng="${currentShop.lng}">🧭 导航</button>
        <button class="detail-action-btn btn-save-close" data-action="saveAndClose">✓ 保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(detail);

  // Star rating
  detail.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      const value = Number(star.dataset.value);
      const container = star.parentElement;
      container.dataset.rating = value;
      container.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('star-active', i < value));
    });
  });

  // Action buttons
  detail.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'toggleStatus') {
      toggleStatus(detail, currentShop.id);
    } else if (action === 'navigateTo') navigateTo(currentShop.lat, currentShop.lng);
    else if (action === 'saveAndClose') saveAndClose(currentShop.id, detail);
    else if (action === 'closeModal') detail.remove();
  });

  detail.addEventListener('click', (e) => {
    if (e.target === detail) {
      saveAndClose(currentShop.id, detail);
    }
  });
}

async function saveAndClose(shopId, detail) {
  const notes = detail.querySelector('#shop-notes').value.trim();
  const rating = Number(detail.querySelector('.stars').dataset.rating);
  try {
    await fetch(`/api/shops/${shopId}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, rating }),
    });
  } catch {}
  // Update local data
  const idx = allShops.findIndex(s => s.id === shopId);
  if (idx !== -1) {
    allShops[idx] = { ...allShops[idx], notes, rating };
  }
  detail.remove();
  if (currentView === 'card') renderCards();
}

async function toggleStatus(detail, shopId) {
  const shop = allShops.find(s => s.id === shopId);
  if (!shop) return;
  const newStatus = shop.status === 'visited' ? 'unvisited' : 'visited';
  const res = await fetch(`/api/shops/${shopId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus }),
  });
  if (res.ok) {
    // Update local data
    const idx = allShops.findIndex(s => s.id === shopId);
    if (idx !== -1) allShops[idx] = { ...allShops[idx], status: newStatus };
    // Update UI immediately
    const statusText = detail.querySelector('.detail-status-text');
    if (statusText) statusText.textContent = newStatus === 'visited' ? '已探' : '未探';
    const btn = detail.querySelector('[data-action="toggleStatus"]');
    if (btn) btn.textContent = newStatus === 'visited' ? '未探' : '已探';
    // Re-render marker with new color
    if (shopMarkers[shopId]) {
      map.removeLayer(shopMarkers[shopId]);
      delete shopMarkers[shopId];
      addShopMarker(allShops[idx]);
    }
    // Update cards if in card view
    if (currentView === 'card') renderCards(true);
  }
}

// ===== Map View =====
function renderMarkers() {
  Object.values(shopMarkers).forEach(m => map.removeLayer(m));
  shopMarkers = {};
  allShops.forEach(shop => addShopMarker(shop));
}

function addShopMarker(shop) {
  if (shopMarkers[shop.id]) return;

  const isVisited = shop.status === 'visited';
  const dist = getDistance(userLat, userLng, shop.lat, shop.lng);
  const markerColor = isVisited ? '#8B6FC0' : (dist <= 2000 ? '#FF9F00' : '#07C160');
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
  marker._shopStatus = isVisited ? '已探' : '未探';
  marker._shopData = shop;
  marker.bindPopup(createShopPopup(shop));
  shopMarkers[shop.id] = marker;
}

function createShopPopup(shop) {
  const popup = document.createElement('div');
  popup.className = 'shop-popup';
  const dist = getDistance(userLat, userLng, shop.lat, shop.lng);
  popup.innerHTML = `
    <div class="shop-popup-name">${escapeHtml(shop.name)}</div>
    ${formatDistance(dist) ? `<div class="shop-popup-dist">${formatDistance(dist)}</div>` : ''}
    <div class="shop-popup-actions">
      <button class="btn btn-primary btn-sm" data-action="toggleVisited" data-id="${shop.id}">${shop.status === 'visited' ? '未探' : '已探'}</button>
      <button class="btn btn-secondary btn-sm" data-action="showDetail" data-id="${shop.id}">详情</button>
      <button class="btn btn-secondary btn-sm" data-action="moveShop" data-id="${shop.id}">移动</button>
      <button class="btn btn-secondary btn-sm" data-action="navigateTo" data-lat="${shop.lat}" data-lng="${shop.lng}">导航</button>
    </div>
  `;

  popup.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'toggleVisited') toggleVisited(Number(btn.dataset.id));
    else if (action === 'showDetail') showDetail(Number(btn.dataset.id));
    else if (action === 'navigateTo') navigateTo(Number(btn.dataset.lat), Number(btn.dataset.lng));
    else if (action === 'moveShop') startMoveShop(Number(btn.dataset.id));
  });

  return popup;
}

// ===== Move Shop =====
let movingShopId = null;
let movingMarker = null;
let moveHint = null;

function startMoveShop(id) {
  const shop = allShops.find(s => s.id === id);
  if (!shop) return;

  // Remove old marker
  const oldMarker = shopMarkers[id];
  if (oldMarker) {
    map.removeLayer(oldMarker);
    delete shopMarkers[id];
  }

  // Create a temporary draggable orange marker
  movingShopId = id;
  const icon = L.divIcon({
    className: 'temp-move-pin',
    html: `<div style="width:22px;height:22px;background:#FF9F00;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 6px rgba(255,159,0,0.2);animation:pulse 1s infinite;"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    draggable: true,
  });

  movingMarker = L.marker([shop.lat, shop.lng], { icon, draggable: true, zIndexOffset: 2000 }).addTo(map);
  map.setView([shop.lat, shop.lng], 16);

  // Disable map panning while dragging the marker
  movingMarker.on('drag', () => { map.dragging.disable(); });
  movingMarker.on('dragend', () => { map.dragging.enable(); });

  // Show hint overlay
  if (moveHint) moveHint.remove();
  const hintDiv = document.createElement('div');
  hintDiv.className = 'move-hint-overlay';
  hintDiv.innerHTML = `
    <div class="move-hint-box">
      <div class="move-hint-text">拖动橙色圆点到新位置</div>
      <div>
        <button class="move-confirm-btn" onclick="confirmMoveShop()">确定</button>
        <button class="move-cancel-btn" onclick="cancelMoveShop()">取消</button>
      </div>
    </div>
  `;
  hintDiv.addEventListener('click', (e) => { if (e.target === hintDiv) cancelMoveShop(); });
  document.body.appendChild(hintDiv);
  moveHint = hintDiv;
}

window.confirmMoveShop = function() {
  if (!movingShopId || !movingMarker) return;
  const newPos = movingMarker.getLatLng();
  const idx = allShops.findIndex(s => s.id === movingShopId);
  if (idx !== -1) {
    allShops[idx] = { ...allShops[idx], lat: newPos.lat, lng: newPos.lng };
  }

  // Update DB
  fetch(`/api/shops/${movingShopId}/location`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: newPos.lat, lng: newPos.lng }),
  }).finally(() => finishMoveShop());
};

window.cancelMoveShop = function() {
  finishMoveShop();
};

function finishMoveShop() {
  if (movingMarker) {
    map.removeLayer(movingMarker);
    movingMarker = null;
  }
  if (moveHint) {
    moveHint.remove();
    moveHint = null;
  }
  map.dragging.enable();
  movingShopId = null;
  renderMarkers();
}

// ===== View Toggle =====
const viewCardBtn = document.getElementById('view-card-btn');
const viewMapBtn = document.getElementById('view-map-btn');
const cardView = document.getElementById('card-view');
const mapContainer = document.getElementById('map-container');
const mapControls = document.getElementById('map-controls');
const longpressHint = document.getElementById('longpress-hint');

function switchView(view) {
  currentView = view;
  if (view === 'card') {
    cardView.classList.remove('hidden');
    mapContainer.classList.add('hidden');
    mapControls.classList.add('visible');
    longpressHint?.classList.add('hidden');
    viewCardBtn.classList.add('view-btn-active');
    viewMapBtn.classList.remove('view-btn-active');
  } else {
    cardView.classList.add('hidden');
    mapContainer.classList.remove('hidden');
    mapControls.classList.add('visible');
    longpressHint?.classList.remove('hidden');
    viewMapBtn.classList.add('view-btn-active');
    viewCardBtn.classList.remove('view-btn-active');
    initMap();
    setTimeout(() => { map.invalidateSize(); renderMarkers(); }, 100);
  }
}

viewCardBtn.addEventListener('click', () => { if (currentView !== 'card') switchView('card'); });
viewMapBtn.addEventListener('click', () => { if (currentView !== 'map') switchView('map'); });

// ===== Distance Filter Pills =====
const distAllPill = document.getElementById('dist-all-pill');

function formatDist(meters) {
  if (meters >= 1000) return (meters / 1000).toFixed(meters % 1000 === 0 ? '0' : '1') + 'km';
  return meters + 'm';
}

document.querySelectorAll('.dist-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const dist = Number(pill.dataset.dist);
    distanceFilter = dist / 1000;
    document.querySelectorAll('.dist-pill').forEach(p => p.classList.remove('dist-pill-active'));
    pill.classList.add('dist-pill-active');
    renderCards(true);
  });
});

// ===== Search =====
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

if (searchInput) {
  let searchTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => performSearch(e.target.value.trim()), 200);
  });
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) showSearchResults(allShops.filter(s => s.name.includes(searchInput.value.trim())));
  });
}

function performSearch(keyword) {
  if (!keyword) {
    searchResults.classList.add('hidden');
    searchResults.innerHTML = '';
    // Reset to show all shops
    loadShops();
    return;
  }

  // Fetch search results from server
  const url = `/api/shops?search=${encodeURIComponent(keyword)}&status=all`;
  fetch(url)
    .then(res => res.json())
    .then(shops => showSearchResults(shops));
}

function showSearchResults(shops) {
  // Sort by distance ascending
  if (userLat && userLng) {
    shops.sort((a, b) => getDistance(userLat, userLng, a.lat, a.lng) - getDistance(userLat, userLng, b.lat, b.lng));
  }

  if (shops.length === 0) {
    searchResults.innerHTML = '<div class="search-empty">没有找到相关店铺</div>';
  } else {
    searchResults.innerHTML = shops.map(shop => {
      const dist = getDistance(userLat, userLng, shop.lat, shop.lng);
      const distStr = formatDistance(dist);
      const statusText = shop.status === 'visited' ? '已探' : '未探';
      return `
        <div class="search-result-item" data-id="${shop.id}">
          <div class="search-result-name">${escapeHtml(shop.name)}</div>
          <div class="search-result-info">${statusText}${distStr ? ' · ' + distStr : ''}</div>
        </div>
      `;
    }).join('');

    // Click handler - fly to shop and open popup
    searchResults.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = Number(item.dataset.id);
        const shop = allShops.find(s => s.id === id);
        if (shop) {
          flyToShop(shop);
        }
        closeSearchResults();
        searchInput.value = '';
      });
    });
  }
  searchResults.classList.remove('hidden');
}

function closeSearchResults() {
  searchResults.classList.add('hidden');
  searchResults.innerHTML = '';
}

function flyToShop(shop) {
  // Switch to map view if in card view
  if (currentView === 'card') switchView('map');

  // Fly to the shop's location
  initMap();
  map.flyTo([shop.lat, shop.lng], 16, { duration: 0.5 });

  // Open popup if marker exists
  setTimeout(() => {
    const marker = shopMarkers[shop.id];
    if (marker) {
      marker.openPopup();
    }
  }, 600);
}

// Close search results when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-bar')) {
    closeSearchResults();
  }
});

// ===== More Menu =====
window.openMoreMenu = function() {
  document.getElementById('more-menu').classList.remove('hidden');
};

window.closeMoreMenu = function() {
  document.getElementById('more-menu').classList.add('hidden');
};

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.navbar-right') && !e.target.closest('#more-menu')) {
    closeMoreMenu();
  }
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
  document.getElementById('shop-detail-modal')?.remove();
  await loadShops();
};

window.unvisitShop = async function(id) {
  await fetch(`/api/shops/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'unvisited' }),
  });
  await loadShops();
  document.getElementById('shop-detail-modal')?.remove();
};

window.toggleVisited = async function(id) {
  const shop = allShops.find(s => s.id === id);
  if (!shop) return;
  const newStatus = shop.status === 'visited' ? 'unvisited' : 'visited';
  const res = await fetch(`/api/shops/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus }),
  });
  if (res.ok) {
    // Update local data
    const idx = allShops.findIndex(s => s.id === id);
    if (idx !== -1) allShops[idx] = { ...allShops[idx], status: newStatus };
    // Update popup button text
    const popupBtn = document.querySelector('.leaflet-popup .shop-popup-actions [data-action="toggleVisited"]');
    if (popupBtn) popupBtn.textContent = newStatus === 'visited' ? '未探' : '已探';
    // Re-render marker with new color
    if (shopMarkers[id]) {
      map.removeLayer(shopMarkers[id]);
      delete shopMarkers[id];
      addShopMarker(allShops[idx]);
    }
    // Update cards if in card view
    if (currentView === 'card') renderCards(true);
  }
};

window.showDetail = async function(id) {
  const marker = shopMarkers[id];
  if (!marker) return;
  openShopCard(marker._shopData);
};

window.previewPhoto = function(photoUrl, photoId) {
  const overlay = document.createElement('div');
  overlay.className = 'photo-preview-overlay';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `
    <img src="${photoUrl}" alt="照片预览">
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
    const res = await fetch(`/api/shops/${shopId}/photo`, { method: 'POST', body: formData });
    if (res.ok) {
      const photo = await res.json();
      // Update local shop data with cover photo
      const idx = allShops.findIndex(s => s.id === shopId);
      if (idx !== -1) {
        allShops[idx].cover_photo = photo.url;
      }
      // Invalidate photo cache for this shop
      delete photoCache[shopId];

      // Update card cover in card view
      updateCardCover(shopId, photo.url);

      document.getElementById('shop-detail-modal')?.remove();
      openShopCard(allShops[idx] || { id: shopId });
    } else {
      const err = await res.json();
      alert(err.error || '上传失败');
    }
  } catch { alert('上传失败，请重试'); }
};

// Update card cover photo in card view after upload
function updateCardCover(shopId, url) {
  const card = document.querySelector(`.shop-card[data-id="${shopId}"]`);
  if (!card) return;
  const cardImage = card.querySelector('.card-image');
  let img = card.querySelector('.card-cover-img');
  if (!img) {
    card.classList.add('has-cover');
    img = document.createElement('img');
    img.className = 'card-cover-img';
    img.alt = '';
    img.loading = 'lazy';
    cardImage.insertBefore(img, cardImage.querySelector('.card-image-emoji'));
  }
  img.src = url;
}

window.deletePhoto = async function(photoId, btn) {
  if (!confirm('确定删除此照片吗？')) return;
  try {
    const res = await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
    if (res.ok) {
      document.querySelector('.photo-preview-overlay')?.remove();
      document.getElementById('shop-detail-modal')?.remove();
    }
  } catch { alert('删除失败'); }
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
  if (pendingMarker) { map.removeLayer(pendingMarker); pendingMarker = null; }
  pendingLat = lat;
  pendingLng = lng;

  const icon = L.divIcon({
    className: 'temp-pin',
    html: `<div style="width:20px;height:20px;background:#FF9F00;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(255,159,0,0.3);animation:pulse 1s infinite;"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    draggable: true,
  });

  pendingMarker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
  pendingMarker.on('dragend', (e) => { const pos = e.target.getLatLng(); pendingLat = pos.lat; pendingLng = pos.lng; });
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
        <div style="margin-top:8px;font-size:12px;color:#999;">坐标: ${pendingLat.toFixed(4)}, ${pendingLng.toFixed(4)}</div>
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
  setTimeout(() => { const input = document.getElementById('add-shop-name'); if (input) input.focus(); }, 300);
  document.getElementById('add-shop-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmAddShop(); });
  modal.addEventListener('click', (e) => { if (e.target === modal) cancelAddShop(); });
}

function cancelAddShop() {
  addingShop = false;
  document.getElementById('add-shop-modal')?.remove();
  if (pendingMarker) { map.removeLayer(pendingMarker); pendingMarker = null; }
  pendingLat = null; pendingLng = null;
}

async function confirmAddShop() {
  const name = document.getElementById('add-shop-name').value.trim();
  if (!name) { alert('请输入店名'); return; }
  const res = await fetch('/api/shops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, lat: pendingLat, lng: pendingLng }),
  });
  if (res.ok) {
    await loadShops();
    cancelAddShop();
  } else { alert('添加失败，请重试'); }
}

// ===== Long Press =====
let longPressTimer = null;
let touchStartPos = null;
let addingShop = false; // Guard against rapid taps
const LONG_PRESS_DURATION = 500;
const MOVE_THRESHOLD = 10;

function initLongPress() {
  if (!map) return;

  const el = map.getContainer();

  // Prevent browser context menu on long press
  el.addEventListener('contextmenu', e => e.preventDefault());

  // Prevent text selection during long press
  el.addEventListener('selectstart', e => e.preventDefault());

  el.addEventListener('touchstart', (e) => {
    if (pendingMarker || addingShop || movingShopId) return;
    // Ignore touches on markers, popups, or controls
    if (e.target.closest('.leaflet-marker-icon, .leaflet-popup, .leaflet-control, .shop-marker-wrapper')) return;
    // Only trigger on empty map areas, not on UI controls
    if (e.target.closest('.map-controls, .navbar, .search-bar, .shop-marker-label')) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    longPressTimer = setTimeout(() => {
      addingShop = true;
      const point = map.mouseEventToContainerPoint(touch);
      const latlng = map.containerPointToLatLng(point);
      startAddShop(latlng.lat, latlng.lng);
    }, LONG_PRESS_DURATION);
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (!touchStartPos) return;
    const touch = e.touches[0];
    if (!touch) return;
    if (Math.abs(touch.clientX - touchStartPos.x) > MOVE_THRESHOLD || Math.abs(touch.clientY - touchStartPos.y) > MOVE_THRESHOLD) {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    }
  }, { passive: true });

  el.addEventListener('touchend', () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    touchStartPos = null;
  }, { passive: true });

  el.addEventListener('touchcancel', () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    touchStartPos = null;
  }, { passive: true });

  map.on('contextmenu', (e) => { e.originalEvent.preventDefault(); if (!pendingMarker && !addingShop && !movingShopId) startAddShop(e.latlng.lat, e.latlng.lng); });
  map.on('mousedown', (e) => {
    if (pendingMarker || addingShop || movingShopId) return;
    longPressTimer = setTimeout(() => { addingShop = true; startAddShop(e.latlng.lat, e.latlng.lng); }, LONG_PRESS_DURATION);
  });
  map.on('mouseup mousemove', () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } });
}

// Override map init to add long press
const origInitMap = initMap;
initMap = function() {
  origInitMap();
  initLongPress();
};

// ===== Init =====
initMap();
setTimeout(() => { map.invalidateSize(); renderMarkers(); }, 200);
initLocation();

// Sync with admin page (delete, add, etc.)
const syncChannel = new BroadcastChannel('travel-map-sync');
syncChannel.addEventListener('message', (e) => {
  if (e.data && e.data.action === 'shop-deleted') {
    loadShops();
  }
});
