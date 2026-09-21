const CART_KEY = 'kb_cart_v1';
const CART_SHOP_KEY = 'kb_cart_shop_v1';

let cartProductsCache = [];
let cartStocksByShop = {};
let cartLoaded = false;

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function getCartShopId() {
  const v = localStorage.getItem(CART_SHOP_KEY);
  return v ? Number(v) : null;
}

function setCartShopId(shopId) {
  if (shopId) {
    localStorage.setItem(CART_SHOP_KEY, String(shopId));
  } else {
    localStorage.removeItem(CART_SHOP_KEY);
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  if (!cart.length) {
    localStorage.removeItem(CART_SHOP_KEY);
  }
  updateCartBadge();
  document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
}

function getProductById(id) {
  return cartProductsCache.find(p => Number(p.id) === Number(id));
}

function getStockForProduct(productId, shopIdOverride = null) {
  const shopId = shopIdOverride || getCartShopId();
  if (!shopId) return 0;
  if (!cartStocksByShop[shopId]) return 0;
  const v = cartStocksByShop[shopId][productId];
  return Number(v) || 0;
}

function addToCart(product, qty = 1, shopId = null) {
  let cart = getCart();
  const currentShopId = getCartShopId();
  const newShopId = shopId || currentShopId;

  if (cart.length && currentShopId && newShopId && Number(currentShopId) !== Number(newShopId)) {
    const confirmChange = confirm(
      'В корзине уже есть товары из другого магазина. Очистить корзину и добавить из нового?'
    );
    if (!confirmChange) return false;
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(CART_SHOP_KEY);
    cart = [];
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: [] }));
  }

  const available = newShopId ? getStockForProduct(product.id, newShopId) : 0;

  const existing = cart.find(item => Number(item.id) === Number(product.id));

  if (existing) {
    const nextQty = existing.qty + qty;
    if (nextQty > available && available > 0) {
      existing.qty = available;
    } else {
      existing.qty = nextQty;
    }
  } else {
    const initial = available > 0 ? Math.min(qty, available) : qty;
    if (initial <= 0) return false;
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      brand: product.brand || '',
      weight: product.weight || '',
      unit: product.unit || (product.type === 'piece' ? 'шт' : 'кг'),
      type: product.type || 'weight',
      image: product.image || '',
      qty: initial
    });
  }

  if (!currentShopId && newShopId) {
    setCartShopId(newShopId);
  }

  saveCart(cart);
  return true;
}

function removeFromCart(id) {
  const cart = getCart().filter(item => Number(item.id) !== Number(id));
  saveCart(cart);
}

function updateQty(id, qty) {
  const cart = getCart();
  const item = cart.find(i => Number(i.id) === Number(id));
  if (!item) return;

  const available = getStockForProduct(id);
  const step = item.type === 'piece' ? 1 : 0.01;

  let next = Number(qty);
  if (isNaN(next) || next <= 0) next = step;
  if (available > 0 && next > available) next = available;

  if (item.type === 'piece') {
    next = Math.round(next);
  } else {
    next = Math.round(next * 1000) / 1000;
  }

  item.qty = next;
  saveCart(cart);
}

function clearCart() {
  saveCart([]);
  setCartShopId(null);
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function cartFormatPrice(n) {
  return Number(n).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' ₽';
}

function cartFormatQty(value, unit) {
  const num = Number(value) || 0;
  if (unit === 'шт') return Math.round(num) + ' шт';
  return (Math.round(num * 1000) / 1000) + ' кг';
}

function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll('[data-cart-count]').forEach(el => {
    el.textContent = Number.isInteger(count) ? count : count.toFixed(1);
    el.style.display = count > 0 ? '' : 'none';
  });
}

async function loadCartProducts() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    cartProductsCache = Array.isArray(data.products) ? data.products : [];
    cartStocksByShop = data.stocksByShop || {};
    cartLoaded = true;
  } catch (err) {
    console.error('Не удалось загрузить товары для корзины:', err);
  }
}

function renderCartEmptyState() {
  const container = document.getElementById('cartItems');
  if (!container) return;

  const emptyEl = document.getElementById('cartEmpty');
  const tableEl = document.getElementById('cartTable');
  const checkoutBtn = document.getElementById('cartCheckout');
  const totalEl = document.getElementById('cartTotal');

  if (emptyEl) emptyEl.style.display = 'block';
  if (tableEl) tableEl.style.display = 'none';
  if (checkoutBtn) checkoutBtn.disabled = true;
  if (totalEl) totalEl.textContent = '0,00 ₽';
  container.innerHTML = '';
}

function renderCartTable() {
  const container = document.getElementById('cartItems');
  if (!container) return;

  const cart = getCart();
  const totalEl = document.getElementById('cartTotal');
  const emptyEl = document.getElementById('cartEmpty');
  const tableEl = document.getElementById('cartTable');
  const checkoutBtn = document.getElementById('cartCheckout');

  if (!cart.length) {
    renderCartEmptyState();
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (tableEl) tableEl.style.display = '';

  container.innerHTML = '';
  let hasErrors = false;

  cart.forEach(item => {
    const product = getProductById(item.id);
    const available = getStockForProduct(item.id);
    const unit = item.unit || 'шт';
    const isPiece = item.type === 'piece';

    if (available <= 0 || item.qty > available) hasErrors = true;

    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    const nameWrap = document.createElement('div');
    nameWrap.className = 'cart-item__name-wrap';

    if (item.image) {
      const thumb = document.createElement('img');
      thumb.src = item.image;
      thumb.className = 'cart-item__thumb';
      thumb.alt = item.name;
      nameWrap.appendChild(thumb);
    }

    const nameCol = document.createElement('div');
    nameCol.className = 'cart-item__name-col';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'cart-item__name';
    nameDiv.textContent = item.name;
    nameCol.appendChild(nameDiv);

    const metaText = [item.brand, item.weight].filter(Boolean).join(', ');
    if (metaText) {
      const metaDiv = document.createElement('div');
      metaDiv.className = 'cart-item__meta';
      metaDiv.textContent = metaText;
      nameCol.appendChild(metaDiv);
    }

    const stockDiv = document.createElement('div');
    stockDiv.className = 'cart-item__stock';
    if (available > 0 && item.qty <= available) {
      stockDiv.textContent = 'В наличии: ' + cartFormatQty(available, unit);
      stockDiv.classList.add('is-available');
    } else if (available > 0) {
      stockDiv.textContent = 'Доступно только ' + cartFormatQty(available, unit);
      stockDiv.classList.add('is-error');
    } else {
      stockDiv.textContent = 'Нет в наличии';
      stockDiv.classList.add('is-error');
    }
    nameCol.appendChild(stockDiv);

    nameWrap.appendChild(nameCol);
    tdName.appendChild(nameWrap);

    const tdPrice = document.createElement('td');
    tdPrice.textContent = cartFormatPrice(item.price);

    const tdQty = document.createElement('td');
    const qtyWrap = document.createElement('div');
    qtyWrap.className = 'cart-qty';

    const step = isPiece ? 1 : 0.5;

    const btnMinus = document.createElement('button');
    btnMinus.type = 'button';
    btnMinus.className = 'cart-qty__btn';
    btnMinus.textContent = '−';
    btnMinus.addEventListener('click', () => {
      const next = item.qty - step;
      if (next <= 0) {
        removeFromCart(item.id);
      } else {
        updateQty(item.id, next);
      }
      renderCartTable();
    });

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'cart-qty__input';
    input.value = item.qty;
    input.min = isPiece ? 1 : 0.01;
    input.step = isPiece ? 1 : 0.01;
    if (available > 0) input.max = available;
    input.addEventListener('change', () => {
      updateQty(item.id, input.value);
      renderCartTable();
    });

    const btnPlus = document.createElement('button');
    btnPlus.type = 'button';
    btnPlus.className = 'cart-qty__btn';
    btnPlus.textContent = '+';
    btnPlus.addEventListener('click', () => {
      const next = item.qty + step;
      if (next > available) {
        btnPlus.textContent = '!';
        setTimeout(() => { btnPlus.textContent = '+'; }, 800);
        return;
      }
      updateQty(item.id, next);
      renderCartTable();
    });

    qtyWrap.appendChild(btnMinus);
    qtyWrap.appendChild(input);
    qtyWrap.appendChild(btnPlus);
    tdQty.appendChild(qtyWrap);

    const tdSum = document.createElement('td');
    tdSum.className = 'cart-item__sum';
    tdSum.textContent = cartFormatPrice(item.price * item.qty);

    const tdAction = document.createElement('td');
    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'cart-item__remove';
    btnRemove.textContent = '✕';
    btnRemove.title = 'Удалить';
    btnRemove.addEventListener('click', () => {
      removeFromCart(item.id);
      renderCartTable();
    });
    tdAction.appendChild(btnRemove);

    tr.appendChild(tdName);
    tr.appendChild(tdPrice);
    tr.appendChild(tdQty);
    tr.appendChild(tdSum);
    tr.appendChild(tdAction);

    container.appendChild(tr);
  });

  if (totalEl) totalEl.textContent = cartFormatPrice(getCartTotal());

  if (checkoutBtn) {
    checkoutBtn.disabled = hasErrors;
    checkoutBtn.textContent = hasErrors
      ? 'Уменьшите количество'
      : 'Оформить заказ';
  }
}

function initCartPage() {
  const container = document.getElementById('cartItems');
  if (!container) return;

  renderCartTable();

  document.addEventListener('cart:updated', renderCartTable);

  const clearBtn = document.getElementById('cartClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Очистить корзину?')) {
        clearCart();
        renderCartTable();
      }
    });
  }

  const checkoutBtn = document.getElementById('cartCheckout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      const cart = getCart();
      if (!cart.length) return;

      for (const item of cart) {
        const available = getStockForProduct(item.id);
        if (item.qty > available) {
          alert('Недостаточно «' + item.name + '». Доступно: ' + available + ' ' + (item.unit || ''));
          return;
        }
      }

      const shopId = getCartShopId();
      if (!shopId) {
        alert('Магазин не выбран. Вернитесь в каталог и выберите магазин.');
        return;
      }

      sessionStorage.setItem('kb_checkout_cart', JSON.stringify(cart));
      sessionStorage.setItem('kb_checkout_total', String(getCartTotal()));
      sessionStorage.setItem('kb_checkout_shop', String(shopId));
      window.location.href = '/delivery-order.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadCartProducts();
  updateCartBadge();
  initCartPage();
});