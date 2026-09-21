let cities = [];
let shopsByCity = {};
let categories = [];
let products = [];
let selectedCity = null;
let selectedShop = null;
let activeTab = null;
let dataLoaded = false;

function getEl(id) {
  return document.getElementById(id);
}

function formatPrice(n) {
  return Number(n).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' ₽';
}

function getCategoryName(categoryId) {
  const cat = categories.find(c => Number(c.id) === Number(categoryId));
  return cat ? cat.name : '—';
}

async function loadAllData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    cities = Array.isArray(data.cities) ? data.cities : [];
    categories = Array.isArray(data.categories) ? data.categories : [];
    products = Array.isArray(data.products) ? data.products : [];

    shopsByCity = {};
    if (Array.isArray(data.shops)) {
      data.shops.forEach(shop => {
        const cityId = Number(shop.cityId);
        if (!shopsByCity[cityId]) shopsByCity[cityId] = [];
        shopsByCity[cityId].push(shop);
      });
    }

    if (cities.length > 0) {
      selectedCity = cities.find(c => c.name === 'Ростов-на-Дону') || cities[0];
      const cityShops = shopsByCity[selectedCity.id] || [];
      if (cityShops.length > 0) selectedShop = cityShops[0];

      const cityLabel = getEl('cityLabel');
      const shopLabel = getEl('shopLabel');
      const shopTitle = getEl('shopTitle');
      if (cityLabel) cityLabel.textContent = selectedCity.name;
      if (shopLabel) shopLabel.textContent = selectedShop ? selectedShop.address : 'Выберите магазин';
      if (shopTitle) shopTitle.textContent = `Магазины в ${selectedCity.name}`;
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
  img.textContent = '🛒';
  if (product.badge) {
    const badge = document.createElement('span');
    badge.className = 'product-card__badge';
    badge.textContent = product.badge;
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
  btn.textContent = product.quantity > 0 ? 'В корзину' : 'Нет в наличии';

  if (product.quantity <= 0) {
    btn.disabled = true;
  } else {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      addToCart(product, 1);
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
  card.href = `/category.html?id=${cat.id}`;

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

function renderCatalogPage() {
  const grid = getEl('productsGrid');
  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  const categoryId = params.get('id');

  let list = [...products];

  if (categoryId) {
    list = list.filter(p => Number(p.categoryId) === Number(categoryId));
    const cat = categories.find(c => Number(c.id) === Number(categoryId));
    const titleEl = document.querySelector('.catalog-title');
    if (titleEl && cat) titleEl.textContent = cat.name;
  }

  const sortSelect = getEl('sortSelect');
  if (sortSelect) {
    const val = sortSelect.value;
    if (val === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (val === 'price-desc') list.sort((a, b) => b.price - a.price);
  }

  renderProducts('productsGrid', list);
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

  const cityLabel = getEl('cityLabel');
  const shopLabel = getEl('shopLabel');
  const shopTitle = getEl('shopTitle');
  const citySearch = getEl('citySearch');
  const shopSearch = getEl('shopSearch');

  if (cityLabel) cityLabel.textContent = city.name;
  if (shopLabel) shopLabel.textContent = 'Выберите магазин';
  if (shopTitle) shopTitle.textContent = `Магазины в ${city.name}`;

  renderCities(citySearch ? citySearch.value : '');
  renderShops(cityId, shopSearch ? shopSearch.value : '');

  if (shopSearch) shopSearch.value = '';
}

function selectShop(shopId) {
  if (!selectedCity) return;

  const shops = shopsByCity[selectedCity.id] || [];
  const shop = shops.find(s => s.id === shopId);
  if (!shop) return;

  selectedShop = shop;

  const shopLabel = getEl('shopLabel');
  const shopSearch = getEl('shopSearch');
  if (shopLabel) shopLabel.textContent = shop.address;

  renderShops(selectedCity.id, shopSearch ? shopSearch.value : '');
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
      if (shopTitle) shopTitle.textContent = `Магазины в ${selectedCity.name}`;
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
      const shopLabel = getEl('shopLabel');
      if (shopLabel) shopLabel.textContent = 'Выберите магазин';
      if (selectedCity) renderShops(selectedCity.id, shopSearch ? shopSearch.value : '');
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

function initSort() {
  const sortSelect = getEl('sortSelect');
  if (!sortSelect) return;
  sortSelect.addEventListener('change', renderCatalogPage);
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

function initCalcInputs() {
  const calcRoot = document.querySelector('.calc-layout');
  if (!calcRoot) return;

  const guestsInput = calcRoot.querySelector('.calc-field__input');
  const allInputs = calcRoot.querySelectorAll('.calc-field__input');
  const durationInput = allInputs[1];
  const budgetInput = document.getElementById('calcBudget');
  const totalEl = calcRoot.querySelector('.calc-result__total-value');
  const resultRows = calcRoot.querySelectorAll('.calc-result__row');
  const suggestEl = document.getElementById('calcSuggest');
  const addAllBtn = document.getElementById('calcAddAll');

  const COEFF = {
    champagne: 0.3,
    wine: 0.4,
    strong: 0.2,
    soft: 0.6,
    snacks: 0.3
  };

  function recalc() {
    const guests = Math.max(1, Number(guestsInput.value) || 1);
    const hours = Math.max(1, Number(durationInput ? durationInput.value : 4) || 4);
    const budget = Number(budgetInput ? budgetInput.value : 0) || 0;

    const durationFactor = hours <= 4 ? 1 : 1 + (hours - 4) * 0.1;

    const champagne = Math.ceil(guests * COEFF.champagne * durationFactor);
    const wine = Math.ceil(guests * COEFF.wine * durationFactor);
    const strong = Math.ceil(guests * COEFF.strong * durationFactor);
    const soft = Math.ceil(guests * COEFF.soft * durationFactor);
    const snacks = (guests * COEFF.snacks).toFixed(1);

    const basePrice =
      champagne * 450 +
      wine * 600 +
      strong * 1200 +
      soft * 80 +
      snacks * 400;

    if (resultRows[0]) resultRows[0].querySelector('.calc-result__value').textContent = guests + ' чел.';
    if (resultRows[1]) resultRows[1].querySelector('.calc-result__value').textContent = champagne + ' бут.';
    if (resultRows[2]) resultRows[2].querySelector('.calc-result__value').textContent = wine + ' бут.';
    if (resultRows[3]) resultRows[3].querySelector('.calc-result__value').textContent = strong + ' бут.';
    if (resultRows[4]) resultRows[4].querySelector('.calc-result__value').textContent = soft + ' л';
    if (resultRows[5]) resultRows[5].querySelector('.calc-result__value').textContent = '~' + snacks + ' кг';

    if (totalEl) totalEl.textContent = '~' + Math.round(basePrice).toLocaleString('ru-RU') + ' ₽';

    if (suggestEl && budget > 0) {
      const suggestions = suggestProducts(budget);
      renderSuggestions(suggestEl, suggestions, budget);
    } else if (suggestEl) {
      const suggestions = suggestProducts(0);
      renderSuggestions(suggestEl, suggestions, 0);
    }
  }

  function suggestProducts(budget) {
    if (!Array.isArray(products) || !products.length) return [];

    const inStock = products.filter(p => p.quantity > 0);
    if (!inStock.length) return [];

    if (budget > 0) {
      const sorted = [...inStock].sort((a, b) => a.price - b.price);
      const picked = [];
      let sum = 0;

      for (const p of sorted) {
        if (sum + p.price <= budget) {
          picked.push(p);
          sum += p.price;
        }
        if (sum >= budget * 0.95) break;
      }

      return picked.length ? picked : [sorted[0]];
    }

    return inStock
      .sort((a, b) => (b.badge ? 1 : 0) - (a.badge ? 1 : 0))
      .slice(0, 6);
  }

  function renderSuggestions(container, list, budget) {
    container.innerHTML = '';

    if (!list.length) {
      container.innerHTML = '<div class="calc-suggest__empty">Подходящих товаров нет</div>';
      return;
    }

    const title = document.createElement('div');
    title.className = 'calc-suggest__title';
    title.textContent = budget > 0
      ? 'Подборка под бюджет ' + budget.toLocaleString('ru-RU') + ' ₽:'
      : 'Популярные товары:';
    container.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'calc-suggest__grid';

    let sum = 0;

    list.forEach(p => {
      sum += p.price;
      const card = document.createElement('div');
      card.className = 'calc-suggest__card';

      const name = document.createElement('div');
      name.className = 'calc-suggest__name';
      name.textContent = p.name;

      const price = document.createElement('div');
      price.className = 'calc-suggest__price';
      price.textContent = formatPrice(p.price);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'calc-suggest__btn';
      btn.textContent = 'В корзину';
      btn.addEventListener('click', () => {
        addToCart(p, 1);
        btn.textContent = 'Добавлено ✓';
        setTimeout(() => btn.textContent = 'В корзину', 1200);
      });

      card.appendChild(name);
      card.appendChild(price);
      card.appendChild(btn);
      grid.appendChild(card);
    });

    container.appendChild(grid);

    if (budget > 0 && sum > 0) {
      const summary = document.createElement('div');
      summary.className = 'calc-suggest__summary';
      summary.textContent = 'Итого подборка: ' + formatPrice(sum);
      container.appendChild(summary);
    }

    if (addAllBtn) {
      addAllBtn.style.display = '';
      addAllBtn.onclick = () => {
        list.forEach(p => addToCart(p, 1));
        addAllBtn.textContent = 'Добавлено ✓';
        setTimeout(() => addAllBtn.textContent = 'Добавить всё в корзину', 1500);
      };
    }
  }

  allInputs.forEach(input => input.addEventListener('input', recalc));
  if (budgetInput) budgetInput.addEventListener('input', recalc);

  recalc();
}

async function init() {
  initMobileMenu();
  initFilters();
  initLocation();
  initSort();

  await loadAllData();

  renderCategories();
  renderFeatured();
  renderCatalogPage();
  initRevealAnimation();
  initCalcInputs();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}