const CART_KEY = 'kb_cart_v1';

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
  document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
}

function addToCart(product, qty = 1) {
  const cart = getCart();
  const existing = cart.find(item => Number(item.id) === Number(product.id));

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      brand: product.brand || '',
      weight: product.weight || '',
      qty: qty
    });
  }

  saveCart(cart);
}

function removeFromCart(id) {
  const cart = getCart().filter(item => Number(item.id) !== Number(id));
  saveCart(cart);
}

function updateQty(id, qty) {
  const cart = getCart();
  const item = cart.find(i => Number(i.id) === Number(id));
  if (!item) return;

  item.qty = Math.max(1, Number(qty) || 1);
  saveCart(cart);
}

function clearCart() {
  saveCart([]);
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

function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll('[data-cart-count]').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? '' : 'none';
  });
}

function initCartPage() {
  const container = document.getElementById('cartItems');
  if (!container) return;

  function render() {
    const cart = getCart();
    const totalEl = document.getElementById('cartTotal');
    const emptyEl = document.getElementById('cartEmpty');
    const tableEl = document.getElementById('cartTable');
    const checkoutBtn = document.getElementById('cartCheckout');

    if (!cart.length) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      if (tableEl) tableEl.style.display = 'none';
      if (checkoutBtn) checkoutBtn.disabled = true;
      if (totalEl) totalEl.textContent = '0,00 ₽';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (tableEl) tableEl.style.display = '';
    if (checkoutBtn) checkoutBtn.disabled = false;

    container.innerHTML = '';

    cart.forEach(item => {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      const nameDiv = document.createElement('div');
      nameDiv.className = 'cart-item__name';
      nameDiv.textContent = item.name;
      tdName.appendChild(nameDiv);

      const metaText = [item.brand, item.weight].filter(Boolean).join(', ');
      if (metaText) {
        const metaDiv = document.createElement('div');
        metaDiv.className = 'cart-item__meta';
        metaDiv.textContent = metaText;
        tdName.appendChild(metaDiv);
      }

      const tdPrice = document.createElement('td');
      tdPrice.textContent = cartFormatPrice(item.price);

      const tdQty = document.createElement('td');
      const qtyWrap = document.createElement('div');
      qtyWrap.className = 'cart-qty';

      const btnMinus = document.createElement('button');
      btnMinus.type = 'button';
      btnMinus.className = 'cart-qty__btn';
      btnMinus.textContent = '−';
      btnMinus.addEventListener('click', () => {
        if (item.qty <= 1) {
          removeFromCart(item.id);
        } else {
          updateQty(item.id, item.qty - 1);
        }
        render();
      });

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'cart-qty__input';
      input.value = item.qty;
      input.min = 1;
      input.addEventListener('change', () => {
        updateQty(item.id, input.value);
        render();
      });

      const btnPlus = document.createElement('button');
      btnPlus.type = 'button';
      btnPlus.className = 'cart-qty__btn';
      btnPlus.textContent = '+';
      btnPlus.addEventListener('click', () => {
        updateQty(item.id, item.qty + 1);
        render();
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
        render();
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
  }

  document.addEventListener('cart:updated', render);
  render();

  const clearBtn = document.getElementById('cartClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Очистить корзину?')) {
        clearCart();
        render();
      }
    });
  }

  const checkoutBtn = document.getElementById('cartCheckout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', async () => {
      const cart = getCart();
      if (!cart.length) return;

      checkoutBtn.disabled = true;
      checkoutBtn.textContent = 'Оформляем…';

      const total = getCartTotal();

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart,
            subtotal: total,
            serviceFee: 0,
            total: total,
            guests: 0,
            hours: 0,
            eventType: '',
            noAlcohol: false,
            budget: 0
          })
        });

        if (!res.ok) throw new Error('HTTP ' + res.status);

        const data = await res.json();
        alert('Заказ №' + data.orderId + ' оформлен! Сумма: ' + cartFormatPrice(total));
        clearCart();
        render();
      } catch (err) {
        console.error('Ошибка оформления заказа:', err);
        alert('Не удалось оформить заказ. Попробуйте позже.');
      } finally {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'Оформить заказ';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  initCartPage();
});