(function () {
  let allProducts = [];
  let filteredProducts = [];

  function fmtPrice(n) {
    return Number(n).toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ₽';
  }

  function fmtQty(value, unit) {
    const num = Number(value) || 0;
    if (unit === 'шт') return Math.round(num) + ' шт';
    return (Math.round(num * 1000) / 1000) + ' кг';
  }

  async function loadProducts() {
    const loadingEl = document.getElementById('myShopLoading');
    const tableEl = document.getElementById('myShopTable');
    const emptyEl = document.getElementById('myShopEmpty');

    try {
      const res = await fetch('/api/manager/products');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      allProducts = Array.isArray(data.products) ? data.products : [];
      filteredProducts = [...allProducts];

      if (loadingEl) loadingEl.style.display = 'none';

      if (!allProducts.length) {
        if (emptyEl) emptyEl.style.display = 'block';
        return;
      }

      if (tableEl) tableEl.style.display = '';
      renderTable();
    } catch (err) {
      console.error('Ошибка загрузки товаров:', err);
      if (loadingEl) loadingEl.textContent = 'Не удалось загрузить товары';
    }
  }

  function renderTable() {
    const body = document.getElementById('myShopBody');
    if (!body) return;

    body.innerHTML = '';

    filteredProducts.forEach(p => {
      const tr = document.createElement('tr');
      tr.dataset.id = p.id;

      const tdId = document.createElement('td');
      tdId.textContent = p.id;

      const tdImg = document.createElement('td');
      if (p.image) {
        const img = document.createElement('img');
        img.src = p.image;
        img.alt = p.name;
        img.className = 'admin-thumb';
        tdImg.appendChild(img);
      } else {
        const span = document.createElement('span');
        span.className = 'admin-thumb admin-thumb--empty';
        span.textContent = '🛒';
        tdImg.appendChild(span);
      }

      const tdName = document.createElement('td');
      tdName.textContent = p.name;

      const tdCat = document.createElement('td');
      tdCat.textContent = p.categoryName;

      const tdBrand = document.createElement('td');
      tdBrand.textContent = p.brand || '—';

      const tdType = document.createElement('td');
      tdType.textContent = p.unit || 'шт';

      const tdPrice = document.createElement('td');
      tdPrice.textContent = fmtPrice(p.price);

      const tdStock = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'my-shop-stock';
      input.value = p.stock;
      input.min = '0';
      input.step = p.type === 'piece' ? '1' : '0.01';
      input.dataset.productId = p.id;
      input.dataset.type = p.type;
      input.dataset.unit = p.unit;
      tdStock.appendChild(input);

      const unit = document.createElement('span');
      unit.className = 'my-shop-unit';
      unit.textContent = ' ' + (p.unit || 'шт');
      tdStock.appendChild(unit);

      const tdAction = document.createElement('td');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'admin-btn-save';
      btn.textContent = 'Сохранить';
      btn.addEventListener('click', () => saveStock(p.id, input, btn));
      tdAction.appendChild(btn);

      tr.appendChild(tdId);
      tr.appendChild(tdImg);
      tr.appendChild(tdName);
      tr.appendChild(tdCat);
      tr.appendChild(tdBrand);
      tr.appendChild(tdType);
      tr.appendChild(tdPrice);
      tr.appendChild(tdStock);
      tr.appendChild(tdAction);

      body.appendChild(tr);
    });
  }

  async function saveStock(productId, input, btn) {
    const value = input.value;
    const originalText = btn.textContent;

    btn.disabled = true;
    btn.textContent = '…';

    try {
      const res = await fetch('/api/manager/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: productId, value: value })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Ошибка сохранения');
      }

      const data = await res.json();
      input.value = data.value;

      btn.textContent = '✓ Сохранено';
      btn.classList.add('is-saved');
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('is-saved');
        btn.disabled = false;
      }, 1200);

      const product = allProducts.find(p => Number(p.id) === Number(productId));
      if (product) product.stock = data.value;
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      alert('Не удалось сохранить: ' + err.message);
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  function initSearch() {
    const search = document.getElementById('tableSearch');
    const countEl = document.getElementById('searchCount');
    if (!search) return;

    function updateCount(visible) {
      if (!countEl) return;
      const total = allProducts.length;
      if (visible === total) {
        countEl.textContent = 'Всего: ' + total;
      } else {
        countEl.textContent = 'Найдено: ' + visible + ' из ' + total;
      }
    }

    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();

      if (!q) {
        filteredProducts = [...allProducts];
      } else {
        filteredProducts = allProducts.filter(p => {
          const text = (p.name + ' ' + p.categoryName + ' ' + (p.brand || '')).toLowerCase();
          return text.includes(q);
        });
      }

      renderTable();
      updateCount(filteredProducts.length);
    });

    updateCount(filteredProducts.length);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
    initSearch();
  });
})();