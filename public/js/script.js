let cities = [];
let shopsByCity = {};
let categories = [];
let products = [];
let stocksByShop = {};
let selectedCity = null;
let selectedShop = null;
let activeTab = null;
let dataLoaded = false;

let catalogFilters = {
  priceMin: 0,
  priceMax: 0,
  categoryIds: [],
  inStock: false,
  withDiscount: false
};

let catalogSort = 'popular';
let catalogCategoryId = null;

function getEl(id) {
  return document.getElementById(id);
}

function formatPrice(n) {
  return Number(n).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' ₽';
}

function formatQty(value, unit) {
  const num = Number(value) || 0;
  if (unit === 'шт') {
    return Math.round(num) + ' шт';
  }
  const rounded = Math.round(num * 1000) / 1000;
  return rounded + ' кг';
}

function getCategoryName(categoryId) {
  const cat = categories.find(c => Number(c.id) === Number(categoryId));
  return cat ? cat.name : '—';
}

function getProductStock(productId) {
  if (!selectedShop) return 0;
  const shopId = selectedShop.id;
  if (!stocksByShop[shopId]) return 0;
  const v = stocksByShop[shopId][productId];
  return Number(v) || 0;
}

async function loadAllData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    cities = Array.isArray(data.cities) ? data.cities : [];
    categories = Array.isArray(data.categories) ? data.categories : [];
    products = Array.isArray(data.products) ? data.products : [];
    stocksByShop = data.stocksByShop || {};

    shopsByCity = {};
    if (Array.isArray(data.shops)) {
      data.shops.forEach(shop => {
        const cityId = Number(shop.cityId);
        if (!shopsByCity[cityId]) shopsByCity[cityId] = [];
        shopsByCity[cityId].push(shop);
      });
    }

    const savedCityId = Number(localStorage.getItem('kb_selected_city')) || null;
    const savedShopId = Number(localStorage.getItem('kb_selected_shop')) || null;

    if (cities.length > 0) {
      let city = null;

      if (savedCityId) {
        city = cities.find(c => Number(c.id) === savedCityId);
      }

      if (!city) {
        city = cities.find(c => c.name === 'Ростов-на-Дону') || cities[0];
      }

      selectedCity = city;
      selectedShop = null;

      const cityShops = shopsByCity[selectedCity.id] || [];

      if (savedShopId) {
        const savedShop = cityShops.find(s => Number(s.id) === savedShopId);
        if (savedShop) selectedShop = savedShop;
      }

      if (!selectedShop && cityShops.length > 0) {
        selectedShop = cityShops[0];
      }

      localStorage.setItem('kb_selected_city', String(selectedCity.id));
      if (selectedShop) {
        localStorage.setItem('kb_selected_shop', String(selectedShop.id));
      } else {
        localStorage.removeItem('kb_selected_shop');
      }

      const cityLabel = getEl('cityLabel');
      const shopLabel = getEl('shopLabel');
      const shopTitle = getEl('shopTitle');
      if (cityLabel) cityLabel.textContent = selectedCity.name;
      if (shopLabel) shopLabel.textContent = selectedShop ? selectedShop.address : 'Выберите магазин';
      if (shopTitle) shopTitle.textContent = 'Магазины в ' + selectedCity.name;
    } else {
      const cityLabel = getEl('cityLabel');
      const shopLabel = getEl('shopLabel');
      if (cityLabel) cityLabel.textContent = 'Выберите город';
      if (shopLabel) shopLabel.textContent = 'Выберите магазин';
    }

    dataLoaded = true;
  } catch (err) {
    console.error('Не удалось загрузить данные:', err);
    const cityLabel = getEl('cityLabel');
    const shopLabel = getEl('shopLabel');
    if (cityLabel) cityLabel.textContent = 'Ошибка загрузки';
    if (shopLabel) shopLabel.textContent = 'Ошибка загрузки';
  }
}

function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.price = product.price;
  card.dataset.id = product.id;

  const img = document.createElement('div');
  img.className = 'product-card__img';

  if (product.image) {
    const imgEl = document.createElement('img');
    imgEl.src = product.image;
    imgEl.alt = product.name;
    imgEl.loading = 'lazy';
    img.appendChild(imgEl);
  } else {
    img.textContent = '🛒';
  }

  if (product.badgeLabel) {
    const badge = document.createElement('span');
    badge.className = 'product-card__badge';
    if (product.badge === 'discount') badge.classList.add('product-card__badge--discount');
    if (product.badge === 'hit') badge.classList.add('product-card__badge--hit');
    if (product.badge === 'new') badge.classList.add('product-card__badge--new');
    badge.textContent = product.badgeLabel;
    img.appendChild(badge);
  }

  const body = document.createElement('div');
  body.className = 'product-card__body';

  const name = document.createElement('div');
  name.className = 'product-card__name';
  name.textContent = product.name;

  const meta = document.createElement('div');
  meta.className = 'product-card__meta';
  const metaParts = [];
  if (product.brand) metaParts.push(product.brand);
  if (product.weight) metaParts.push(product.weight);
  meta.textContent = metaParts.join(', ') || getCategoryName(product.categoryId);

  const stock = document.createElement('div');
  stock.className = 'product-card__stock';
  const available = getProductStock(product.id);
  const unit = product.unit || (product.type === 'piece' ? 'шт' : 'кг');
  if (available > 0) {
    stock.textContent = 'В наличии: ' + formatQty(available, unit);
    stock.classList.add('is-available');
  } else {
    stock.textContent = 'Нет в наличии';
    stock.classList.add('is-empty');
  }

  const price = document.createElement('div');
  price.className = 'product-card__price';
  price.textContent = formatPrice(product.price);

  if (product.oldPrice) {
    const old = document.createElement('span');
    old.className = 'product-card__old';
    old.textContent = formatPrice(product.oldPrice);
    price.appendChild(old);
  }

  const btn = document.createElement('button');
  btn.className = 'product-card__btn';

  if (!selectedShop) {
    btn.textContent = 'Выберите магазин';
    btn.disabled = true;
  } else if (available <= 0) {
    btn.textContent = 'Нет в наличии';
    btn.disabled = true;
  } else {
    btn.textContent = 'В корзину';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cartItem = getCart().find(i => Number(i.id) === Number(product.id));
      const inCart = cartItem ? cartItem.qty : 0;
      const step = product.type === 'piece' ? 1 : 0.5;
      if (inCart + step > available) {
        btn.textContent = 'Максимум в корзине';
        setTimeout(() => { btn.textContent = 'В корзину'; }, 1500);
        return;
      }
      const ok = addToCart(product, step, selectedShop.id);
      if (!ok) return;
      btn.textContent = 'Добавлено ✓';
      btn.classList.add('is-added');
      setTimeout(() => {
        btn.textContent = 'В корзину';
        btn.classList.remove('is-added');
      }, 1200);
    });
  }

  body.appendChild(name);
  body.appendChild(meta);
  body.appendChild(stock);
  body.appendChild(price);
  body.appendChild(btn);

  card.appendChild(img);
  card.appendChild(body);
  return card;
}

function renderProducts(containerId, list) {
  const container = getEl(containerId);
  if (!container) return;

  container.innerHTML = '';

  if (!list.length) {
    const empty = getEl('catalogEmpty');
    if (empty) empty.style.display = 'block';
    return;
  }

  const empty = getEl('catalogEmpty');
  if (empty) empty.style.display = 'none';

  list.forEach(p => container.appendChild(createProductCard(p)));
}

function createCategoryCard(cat) {
  const card = document.createElement('a');
  card.className = 'category-card';
  card.href = '/category.html?id=' + cat.id;

  const img = document.createElement('div');
  img.className = 'category-card__img';
  img.textContent = '🛍';

  const name = document.createElement('div');
  name.className = 'category-card__name';
  name.textContent = cat.name;

  const count = document.createElement('div');
  count.className = 'category-card__count';
  count.textContent = (cat.count || 0) + '+ товаров';

  card.appendChild(img);
  card.appendChild(name);
  card.appendChild(count);
  return card;
}

function renderCategories() {
  const grid = getEl('categoriesGrid');
  if (!grid) return;

  grid.innerHTML = '';
  categories.forEach(cat => grid.appendChild(createCategoryCard(cat)));
}

function renderFeatured() {
  const grid = getEl('featuredGrid');
  if (!grid) return;

  const featured = [...products]
    .filter(p => p.badge || p.oldPrice)
    .slice(0, 8);

  const list = featured.length ? featured : products.slice(0, 8);
  renderProducts('featuredGrid', list);
}

function getFilteredProducts() {
  let list = [...products];

  if (catalogCategoryId) {
    list = list.filter(p => Number(p.categoryId) === Number(catalogCategoryId));
  }

  if (catalogFilters.categoryIds.length) {
    list = list.filter(p => catalogFilters.categoryIds.includes(Number(p.categoryId)));
  }

  if (catalogFilters.priceMin > 0) {
    list = list.filter(p => Number(p.price) >= catalogFilters.priceMin);
  }

  if (catalogFilters.priceMax > 0) {
    list = list.filter(p => Number(p.price) <= catalogFilters.priceMax);
  }

  if (catalogFilters.inStock) {
    list = list.filter(p => getProductStock(p.id) > 0);
  }

  if (catalogFilters.withDiscount) {
    list = list.filter(p => p.oldPrice || Number(p.discountPercent) > 0);
  }

  if (catalogSort === 'price-asc') list.sort((a, b) => a.price - b.price);
  if (catalogSort === 'price-desc') list.sort((a, b) => b.price - a.price);
  if (catalogSort === 'new') list.sort((a, b) => Number(b.id) - Number(a.id));

  return list;
}

function renderCatalogPage() {
  const grid = getEl('productsGrid');
  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  const categoryIdFromUrl = params.get('id');

  if (categoryIdFromUrl) {
    catalogCategoryId = Number(categoryIdFromUrl);
    const cat = categories.find(c => Number(c.id) === Number(catalogCategoryId));
    const titleEl = document.querySelector('.catalog-title');
    const bcEl = getEl('breadcrumbCategory');
    if (titleEl && cat) titleEl.textContent = cat.name;
    if (bcEl && cat) bcEl.textContent = cat.name;
  } else {
    catalogCategoryId = null;
  }

  const list = getFilteredProducts();
  renderProducts('productsGrid', list);

  const countEl = getEl('catalogCount');
  if (countEl) {
    countEl.textContent = 'Найдено: ' + list.length + ' товаров';
  }
}

function refreshProductGrids() {
  const featured = getEl('featuredGrid');
  const productsGrid = getEl('productsGrid');

  if (featured) renderFeatured();
  if (productsGrid) renderCatalogPage();
}

function initCatalogFilters() {
  const priceMin = getEl('filterPriceMin');
  const priceMax = getEl('filterPriceMax');
  const inStock = getEl('filterInStock');
  const withDiscount = getEl('filterWithDiscount');
  const applyBtn = getEl('filterApplyBtn');
  const resetBtn = getEl('filterResetBtn');
  const sortSelect = getEl('sortSelect');

  function readFilters() {
    catalogFilters.priceMin = Number(priceMin ? priceMin.value : 0) || 0;
    catalogFilters.priceMax = Number(priceMax ? priceMax.value : 0) || 0;
    catalogFilters.inStock = !!(inStock && inStock.checked);
    catalogFilters.withDiscount = !!(withDiscount && withDiscount.checked);

    const checked = document.querySelectorAll('#filtersCategories input[type="checkbox"]:checked');
    catalogFilters.categoryIds = Array.from(checked).map(c => Number(c.value));
  }

  function apply() {
    readFilters();
    renderCatalogPage();
  }

  function reset() {
    if (priceMin) priceMin.value = '';
    if (priceMax) priceMax.value = '';
    if (inStock) inStock.checked = false;
    if (withDiscount) withDiscount.checked = false;
    document.querySelectorAll('#filtersCategories input[type="checkbox"]').forEach(c => {
      c.checked = false;
    });
    catalogFilters = {
      priceMin: 0,
      priceMax: 0,
      categoryIds: [],
      inStock: false,
      withDiscount: false
    };
    renderCatalogPage();
  }

  if (applyBtn) applyBtn.addEventListener('click', apply);
  if (resetBtn) resetBtn.addEventListener('click', reset);
  if (inStock) inStock.addEventListener('change', apply);
  if (withDiscount) withDiscount.addEventListener('change', apply);

  let priceTimer = null;
  function onPriceChange() {
    clearTimeout(priceTimer);
    priceTimer = setTimeout(apply, 350);
  }
  if (priceMin) priceMin.addEventListener('input', onPriceChange);
  if (priceMax) priceMax.addEventListener('input', onPriceChange);

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      catalogSort = sortSelect.value;
      renderCatalogPage();
    });
  }

  const filtersCat = getEl('filtersCategories');
  if (filtersCat && !filtersCat.dataset.rendered) {
    filtersCat.dataset.rendered = '1';
    categories.forEach(cat => {
      const label = document.createElement('label');
      label.className = 'filters__option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = cat.id;
      input.addEventListener('change', apply);
      const span = document.createElement('span');
      span.textContent = cat.name;
      label.appendChild(input);
      label.appendChild(span);
      filtersCat.appendChild(label);
    });
  }
}

function renderCities(filter) {
  const cityList = getEl('cityList');
  if (!cityList) return;

  const q = (filter || '').trim().toLowerCase();
  const list = q ? cities.filter(c => c.name.toLowerCase().includes(q)) : cities;

  cityList.innerHTML = '';

  if (!list.length) {
    cityList.innerHTML = '<div class="loc-dropdown__empty">Города не найдены</div>';
    return;
  }

  list.forEach(city => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'loc-dropdown__item' + (selectedCity && city.id === selectedCity.id ? ' is-selected' : '');
    btn.dataset.cityId = city.id;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = city.name;

    const countSpan = document.createElement('span');
    countSpan.className = 'loc-dropdown__item-count';
    countSpan.textContent = (city.shops || 0) + ' магазинов';

    btn.appendChild(nameSpan);
    btn.appendChild(countSpan);
    btn.addEventListener('click', () => selectCity(city.id));

    cityList.appendChild(btn);
  });
}

function renderShops(cityId, filter) {
  const shopList = getEl('shopList');
  if (!shopList) return;

  const shops = shopsByCity[cityId] || [];
  const q = (filter || '').trim().toLowerCase();
  const list = q ? shops.filter(s => s.address.toLowerCase().includes(q)) : shops;

  shopList.innerHTML = '';

  if (!list.length) {
    shopList.innerHTML = '<div class="loc-dropdown__empty">Магазины не найдены</div>';
    return;
  }

  list.forEach(shop => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'loc-dropdown__shop' + (selectedShop && shop.id === selectedShop.id ? ' is-selected' : '');
    btn.dataset.shopId = shop.id;

    const addressSpan = document.createElement('span');
    addressSpan.className = 'loc-dropdown__shop-address';
    addressSpan.textContent = shop.address;

    const metaSpan = document.createElement('span');
    metaSpan.className = 'loc-dropdown__shop-meta';

    const hoursSpan = document.createElement('span');
    hoursSpan.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
    hoursSpan.appendChild(document.createTextNode(' ' + (shop.hours || '')));

    const metroSpan = document.createElement('span');
    metroSpan.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';
    metroSpan.appendChild(document.createTextNode(' ' + (shop.metro || '—')));

    metaSpan.appendChild(hoursSpan);
    metaSpan.appendChild(metroSpan);

    btn.appendChild(addressSpan);
    btn.appendChild(metaSpan);
    btn.addEventListener('click', () => selectShop(shop.id));

    shopList.appendChild(btn);
  });
}

function selectCity(cityId) {
  const city = cities.find(c => c.id === cityId);
  if (!city) return;

  selectedCity = city;
  selectedShop = null;

  const cityShops = shopsByCity[city.id] || [];
  if (cityShops.length > 0) {
    selectedShop = cityShops[0];
  }

  localStorage.setItem('kb_selected_city', String(selectedCity.id));
  if (selectedShop) {
    localStorage.setItem('kb_selected_shop', String(selectedShop.id));
  } else {
    localStorage.removeItem('kb_selected_shop');
  }

  const cityLabel = getEl('cityLabel');
  const shopLabel = getEl('shopLabel');
  const shopTitle = getEl('shopTitle');
  const citySearch = getEl('citySearch');
  const shopSearch = getEl('shopSearch');

  if (cityLabel) cityLabel.textContent = city.name;
  if (shopLabel) shopLabel.textContent = selectedShop ? selectedShop.address : 'Выберите магазин';
  if (shopTitle) shopTitle.textContent = 'Магазины в ' + city.name;

  renderCities(citySearch ? citySearch.value : '');
  renderShops(cityId, shopSearch ? shopSearch.value : '');

  if (shopSearch) shopSearch.value = '';

  refreshProductGrids();
}

function selectShop(shopId) {
  if (!selectedCity) return;

  const shops = shopsByCity[selectedCity.id] || [];
  const shop = shops.find(s => s.id === shopId);
  if (!shop) return;

  selectedShop = shop;
  localStorage.setItem('kb_selected_shop', String(shop.id));
  localStorage.setItem('kb_selected_city', String(selectedCity.id));

  const shopLabel = getEl('shopLabel');
  const shopSearch = getEl('shopSearch');
  if (shopLabel) shopLabel.textContent = shop.address;

  renderShops(selectedCity.id, shopSearch ? shopSearch.value : '');

  refreshProductGrids();

  setTimeout(() => closeDropdown(), 150);
}

function openDropdown(tab) {
  const dropdown = getEl('locDropdown');
  if (!dropdown || !dataLoaded) return;

  activeTab = tab;
  dropdown.classList.add('is-open');

  const cityBtn = getEl('cityBtn');
  const shopBtn = getEl('shopBtn');
  const citySearch = getEl('citySearch');
  const shopSearch = getEl('shopSearch');
  const shopTitle = getEl('shopTitle');

  if (cityBtn) cityBtn.classList.toggle('is-active', tab === 'city');
  if (shopBtn) shopBtn.classList.toggle('is-active', tab === 'shop');

  if (tab === 'city') {
    if (citySearch) citySearch.value = '';
    renderCities('');
    setTimeout(() => citySearch && citySearch.focus(), 80);
  } else {
    if (shopSearch) shopSearch.value = '';
    if (selectedCity) {
      if (shopTitle) shopTitle.textContent = 'Магазины в ' + selectedCity.name;
      renderShops(selectedCity.id, '');
    } else {
      const shopList = getEl('shopList');
      if (shopList) shopList.innerHTML = '<div class="loc-dropdown__empty">Сначала выберите город</div>';
    }
    setTimeout(() => shopSearch && shopSearch.focus(), 80);
  }
}

function closeDropdown() {
  const dropdown = getEl('locDropdown');
  if (!dropdown) return;

  activeTab = null;
  dropdown.classList.remove('is-open');

  const cityBtn = getEl('cityBtn');
  const shopBtn = getEl('shopBtn');
  if (cityBtn) cityBtn.classList.remove('is-active');
  if (shopBtn) shopBtn.classList.remove('is-active');
}

function initLocation() {
  const cityBtn = getEl('cityBtn');
  const shopBtn = getEl('shopBtn');
  const shopClear = getEl('shopClear');
  const dropdown = getEl('locDropdown');
  const citySearch = getEl('citySearch');
  const shopSearch = getEl('shopSearch');

  if (cityBtn) {
    cityBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeTab === 'city') closeDropdown();
      else openDropdown('city');
    });
  }

  if (shopBtn) {
    shopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeTab === 'shop') closeDropdown();
      else openDropdown('shop');
    });
  }

  if (shopClear) {
    shopClear.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedShop = null;
      localStorage.removeItem('kb_selected_shop');
      const shopLabel = getEl('shopLabel');
      if (shopLabel) shopLabel.textContent = 'Выберите магазин';
      if (selectedCity) renderShops(selectedCity.id, shopSearch ? shopSearch.value : '');
      refreshProductGrids();
    });
  }

  if (citySearch) citySearch.addEventListener('input', (e) => renderCities(e.target.value));
  if (shopSearch) {
    shopSearch.addEventListener('input', (e) => {
      if (selectedCity) renderShops(selectedCity.id, e.target.value);
    });
  }

  if (dropdown) dropdown.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('click', () => {
    if (activeTab) closeDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeTab) closeDropdown();
  });
}

function initMobileMenu() {
  const btn = document.querySelector('.mobile-menu-btn');
  const nav = document.querySelector('.nav');
  if (btn && nav) {
    btn.addEventListener('click', () => nav.classList.toggle('nav--open'));
  }
}

function initFilters() {
  const filtersBtn = getEl('filtersBtn');
  const filters = getEl('filters');
  if (!filtersBtn || !filters) return;

  function checkMobile() {
    if (window.innerWidth <= 768) {
      filtersBtn.style.display = 'inline-flex';
      const closeBtn = filters.querySelector('.filters__title .mobile-menu-btn');
      if (closeBtn) closeBtn.style.display = 'flex';
    } else {
      filtersBtn.style.display = 'none';
      filters.classList.remove('is-open');
      const closeBtn = filters.querySelector('.filters__title .mobile-menu-btn');
      if (closeBtn) closeBtn.style.display = 'none';
    }
  }

  checkMobile();
  window.addEventListener('resize', checkMobile);

  filtersBtn.addEventListener('click', () => filters.classList.toggle('is-open'));
}

function initNavScrollbar() {
  const navs = document.querySelectorAll('[data-nav]');
  if (!navs.length) return;

  navs.forEach(nav => {
    const wrap = nav.closest('.nav-wrap');
    if (!wrap) return;
    const scrollbar = wrap.querySelector('.nav-scrollbar');
    const thumb = wrap.querySelector('.nav-scrollbar__thumb');
    if (!scrollbar || !thumb) return;

    function update() {
      const scrollWidth = nav.scrollWidth;
      const clientWidth = nav.clientWidth;
      const maxScroll = scrollWidth - clientWidth;

      if (maxScroll <= 0) {
        scrollbar.style.display = 'none';
        return;
      }

      scrollbar.style.display = 'block';

      const trackWidth = scrollbar.clientWidth;
      const ratio = clientWidth / scrollWidth;
      const thumbWidth = Math.max(30, trackWidth * ratio);

      thumb.style.width = thumbWidth + 'px';

      const scrollLeft = nav.scrollLeft;
      const maxThumbMove = trackWidth - thumbWidth;
      const thumbOffset = maxScroll > 0 ? (scrollLeft / maxScroll) * maxThumbMove : 0;

      thumb.style.transform = 'translateX(' + thumbOffset + 'px)';
    }

    nav.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    update();
  });
}

function initRevealAnimation() {
  const targets = document.querySelectorAll('.product-card, .category-card, .quick-card');
  if (!targets.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  targets.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}

async function init() {
  initMobileMenu();
  initFilters();
  initLocation();
  initNavScrollbar();

  await loadAllData();

  initCatalogFilters();

  renderCategories();
  renderFeatured();
  renderCatalogPage();
  initRevealAnimation();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}