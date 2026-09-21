let partners = [];
let selectedPartner = null;
let currentSlide = 0;
let promoDiscount = 0;
let promoCode = '';
let promoId = null;

function fmtPrice(n) {
  return Number(n).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' ₽';
}

function getCartFromSession() {
  try {
    const raw = sessionStorage.getItem('kb_checkout_cart');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function getCartTotalFromSession() {
  return Number(sessionStorage.getItem('kb_checkout_total')) || 0;
}

async function loadPartners() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    partners = Array.isArray(data.partners) ? data.partners : [];
  } catch (err) {
    console.error('Ошибка загрузки партнёров:', err);
    partners = [];
  }
}

function createPartnerSlide(partner) {
  const slide = document.createElement('div');
  slide.className = 'order-slide';
  slide.dataset.partnerId = partner.id;

  const logo = document.createElement('div');
  logo.className = 'order-slide__logo';
  if (partner.logo) {
    const img = document.createElement('img');
    img.src = partner.logo;
    img.alt = partner.name;
    logo.appendChild(img);
  } else {
    logo.textContent = '🚚';
  }

  const name = document.createElement('div');
  name.className = 'order-slide__name';
  name.textContent = partner.name;

  const price = document.createElement('div');
  price.className = 'order-slide__price';
  price.textContent = 'Доставка: ' + fmtPrice(partner.deliveryFee || 0);

  const service = document.createElement('div');
  service.className = 'order-slide__service';
  service.textContent = 'Сервисный сбор: ' + fmtPrice(partner.serviceFee || 0);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'order-slide__btn';
  btn.textContent = 'Выбрать';
  btn.addEventListener('click', () => selectPartner(partner));

  slide.appendChild(logo);
  slide.appendChild(name);
  slide.appendChild(price);
  slide.appendChild(service);
  slide.appendChild(btn);

  return slide;
}

function renderPartners() {
  const emptyEl = document.getElementById('orderPartnersEmpty');
  const slider = document.getElementById('orderSlider');

  if (!slider) return;

  if (!partners.length) {
    if (emptyEl) {
      emptyEl.style.display = 'block';
      emptyEl.textContent = 'Партнёры доставки пока не добавлены';
    }
    slider.innerHTML = '';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  slider.innerHTML = '';
  partners.forEach(p => slider.appendChild(createPartnerSlide(p)));

  updateSliderPosition();
}

function updateSliderPosition() {
  const slider = document.getElementById('orderSlider');
  if (!slider) return;
  const cardWidth = 280 + 16;
  slider.style.transform = 'translateX(' + (-currentSlide * cardWidth) + 'px)';
}

function selectPartner(partner) {
  selectedPartner = partner;

  document.querySelectorAll('.order-slide').forEach(s => {
    s.classList.toggle('is-selected', Number(s.dataset.partnerId) === Number(partner.id));
  });

  recalc();
}

function recalc() {
  const subtotal = getCartTotalFromSession();
  const deliveryFee = selectedPartner ? Number(selectedPartner.deliveryFee) || 0 : 0;
  const serviceFee = selectedPartner ? Number(selectedPartner.serviceFee) || 0 : 0;
  const discountValue = Number(promoDiscount) || 0;
  const total = subtotal + deliveryFee + serviceFee - discountValue;

  const subtotalEl = document.getElementById('orderSubtotal');
  const deliveryEl = document.getElementById('orderDelivery');
  const serviceEl = document.getElementById('orderService');
  const discountRow = document.getElementById('orderDiscountRow');
  const discountEl = document.getElementById('orderDiscount');
  const totalEl = document.getElementById('orderTotal');
  const confirmBtn = document.getElementById('orderConfirm');

  if (subtotalEl) subtotalEl.textContent = fmtPrice(subtotal);
  if (deliveryEl) deliveryEl.textContent = selectedPartner ? fmtPrice(deliveryFee) : '—';
  if (serviceEl) serviceEl.textContent = selectedPartner ? fmtPrice(serviceFee) : '—';

  if (discountRow && discountEl) {
    if (discountValue > 0) {
      discountRow.style.display = '';
      discountEl.textContent = '−' + fmtPrice(discountValue);
    } else {
      discountRow.style.display = 'none';
    }
  }

  if (totalEl) totalEl.textContent = fmtPrice(Math.max(0, total));

  if (confirmBtn) {
    const ok = selectedPartner && subtotal > 0;
    confirmBtn.disabled = !ok;
    confirmBtn.textContent = !selectedPartner ? 'Выберите доставку' : 'Подтвердить заказ';
  }
}

async function applyPromo() {
  const input = document.getElementById('orderPromoInput');
  const msg = document.getElementById('orderPromoMsg');
  const resetBtn = document.getElementById('orderPromoReset');
  if (!input || !msg) return;

  const code = input.value.trim();

  if (!code) {
    msg.textContent = 'Введите промокод';
    msg.className = 'order-summary__promo-msg is-error';
    return;
  }

  const cart = getCartFromSession();
  const subtotal = getCartTotalFromSession();

  if (!cart.length || !subtotal) {
    msg.textContent = 'Корзина пуста';
    msg.className = 'order-summary__promo-msg is-error';
    return;
  }

  msg.textContent = 'Проверяем…';
  msg.className = 'order-summary__promo-msg';

  try {
    const res = await fetch('/api/promo/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, items: cart, subtotal: subtotal })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      promoCode = '';
      promoId = null;
      promoDiscount = 0;
      msg.textContent = data.message || 'Промокод не найден';
      msg.className = 'order-summary__promo-msg is-error';
      if (resetBtn) resetBtn.style.display = 'none';
      recalc();
      return;
    }

    promoCode = data.code;
    promoId = data.promoId;
    promoDiscount = Number(data.discount) || 0;

    msg.textContent = 'Промокод применён: скидка ' + fmtPrice(promoDiscount);
    msg.className = 'order-summary__promo-msg is-success';
    if (resetBtn) resetBtn.style.display = '';
    recalc();
  } catch (err) {
    console.error('Ошибка проверки промокода:', err);
    msg.textContent = 'Ошибка проверки промокода';
    msg.className = 'order-summary__promo-msg is-error';
  }
}

function resetPromo() {
  promoCode = '';
  promoId = null;
  promoDiscount = 0;

  const input = document.getElementById('orderPromoInput');
  const msg = document.getElementById('orderPromoMsg');
  const resetBtn = document.getElementById('orderPromoReset');

  if (input) input.value = '';
  if (msg) {
    msg.textContent = '';
    msg.className = 'order-summary__promo-msg';
  }
  if (resetBtn) resetBtn.style.display = 'none';

  recalc();
}

function initPromo() {
  const input = document.getElementById('orderPromoInput');
  const btn = document.getElementById('orderPromoBtn');
  const resetBtn = document.getElementById('orderPromoReset');
  if (!input || !btn) return;

  btn.addEventListener('click', applyPromo);
  if (resetBtn) resetBtn.addEventListener('click', resetPromo);
}

function initSlider() {
  const prev = document.getElementById('orderPrev');
  const next = document.getElementById('orderNext');

  if (prev) {
    prev.addEventListener('click', () => {
      if (currentSlide > 0) {
        currentSlide--;
        updateSliderPosition();
      }
    });
  }

  if (next) {
    next.addEventListener('click', () => {
      const maxSlide = Math.max(0, partners.length - 1);
      if (currentSlide < maxSlide) {
        currentSlide++;
        updateSliderPosition();
      }
    });
  }
}

function initConfirm() {
  const btn = document.getElementById('orderConfirm');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!selectedPartner) return;

    const cart = getCartFromSession();
    if (!cart.length) {
      alert('Корзина пуста');
      window.location.href = '/cart.html';
      return;
    }

    const subtotal = getCartTotalFromSession();
    const deliveryFee = Number(selectedPartner.deliveryFee) || 0;
    const serviceFee = Number(selectedPartner.serviceFee) || 0;
    const discountValue = Number(promoDiscount) || 0;
    const total = subtotal + deliveryFee + serviceFee - discountValue;

    btn.disabled = true;
    btn.textContent = 'Отправляем…';

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          subtotal: subtotal,
          serviceFee: serviceFee,
          deliveryFee: deliveryFee,
          promoCode: promoCode,
          promoDiscount: promoDiscount,
          deliveryPartnerId: selectedPartner.id,
          total: total,
          guests: 0,
          hours: 0,
          eventType: '',
          noAlcohol: false,
          budget: 0,
          shopId: null
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Ошибка оформления');
      }

      const data = await res.json();
      clearCart();
      sessionStorage.removeItem('kb_checkout_cart');
      sessionStorage.removeItem('kb_checkout_total');
      alert('Заказ №' + data.orderId + ' оформлен! Сумма: ' + fmtPrice(total));
      window.location.href = '/';
    } catch (err) {
      console.error('Ошибка:', err);
      alert('Не удалось оформить заказ: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Подтвердить заказ';
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadPartners();
  renderPartners();
  recalc();
  initPromo();
  initSlider();
  initConfirm();
});