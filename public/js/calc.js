let calcSettings = {
  serviceFee: 5,
  minGuests: 5,
  maxGuests: 100,
  minHours: 1,
  maxHours: 12,
  eventMultipliers: {
    wedding: 20,
    corporate: 10,
    birthday: 5,
    party: 5
  }
};

let calcProducts = [];
let calcReady = false;

function calcClamp(value, min, max) {
  const n = Number(value);
  if (isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function calcEventMultiplier(type) {
  const map = calcSettings.eventMultipliers || {};
  const val = Number(map[type]) || 0;
  return 1 + val / 100;
}

function calcEventLabel(type) {
  const labels = {
    wedding: 'Свадьба',
    corporate: 'Корпоратив',
    birthday: 'День рождения',
    party: 'Дружеская вечеринка'
  };
  return labels[type] || type;
}

function calcIsAlcoholic(product) {
  if (!product) return false;
  const parts = [
    product.name || '',
    product.brand || '',
    product.categoryName || ''
  ].join(' ').toLowerCase();
  const alcoholWords = [
    'вино', 'водка', 'пиво', 'виски', 'коньяк', 'шампанское',
    'ром', 'джин', 'ликер', 'настойка', 'текила', 'алкоголь',
    'бурбон', 'бренди', 'вермут', 'игристое', 'сидр', 'медовуха'
  ];
  return alcoholWords.some(w => parts.includes(w));
}

function calcFormatPrice(n) {
  return Number(n).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' ₽';
}

function calcGetCartTotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.qty, 0);
}

function calcGetCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function calcGetCategoriesMap() {
  const map = {};
  if (Array.isArray(categories)) {
    categories.forEach(c => {
      map[Number(c.id)] = c.name;
    });
  }
  return map;
}

function calcRecalc() {
  if (!calcReady) return;

  const guestsEl = document.getElementById('calcGuests');
  const hoursEl = document.getElementById('calcHours');
  const budgetEl = document.getElementById('calcBudget');
  const eventEl = document.getElementById('calcEventType');
  const noAlcoholEl = document.getElementById('calcNoAlcohol');

  if (!guestsEl || !hoursEl) return;

  const guests = calcClamp(guestsEl.value, calcSettings.minGuests, calcSettings.maxGuests);
  const hours = calcClamp(hoursEl.value, calcSettings.minHours, calcSettings.maxHours);
  const budget = Number(budgetEl.value) || 0;
  const eventType = eventEl.value;
  const noAlcohol = noAlcoholEl.checked;

  guestsEl.value = guests;
  hoursEl.value = hours;

  const cartTotal = calcGetCartTotal();
  const cartCount = calcGetCartCount();
  const multiplier = calcEventMultiplier(eventType);
  const subtotal = cartTotal * multiplier;
  const fee = subtotal * (calcSettings.serviceFee / 100);
  const total = subtotal + fee;

  document.getElementById('resGuests').textContent = guests + ' чел.';
  document.getElementById('resHours').textContent = hours + ' ч';
  document.getElementById('resCount').textContent = cartCount;
  document.getElementById('resSubtotal').textContent = calcFormatPrice(subtotal);
  document.getElementById('resFeePct').textContent = calcSettings.serviceFee;
  document.getElementById('resFee').textContent = calcFormatPrice(fee);
  document.getElementById('resTotal').textContent = calcFormatPrice(total);

  const budgetRow = document.getElementById('resBudgetRow');
  const remainRow = document.getElementById('resRemainRow');

  if (budget > 0) {
    budgetRow.style.display = '';
    remainRow.style.display = '';
    document.getElementById('resBudget').textContent = calcFormatPrice(budget);

    const remain = budget - total;
    const remainEl = document.getElementById('resRemain');
    remainEl.textContent = calcFormatPrice(remain);
    remainEl.style.color = remain >= 0 ? '#8CE99A' : '#FFC9C9';
  } else {
    budgetRow.style.display = 'none';
    remainRow.style.display = 'none';
  }

  renderCalcSuggestions(guests, hours, budget, noAlcohol, total);
}

function renderCalcSuggestions(guests, hours, budget, noAlcohol, currentTotal) {
  const container = document.getElementById('calcSuggest');
  if (!container) return;

  container.innerHTML = '';

  if (!calcProducts.length) {
    container.innerHTML = '<div class="calc-suggest__empty">Товары ещё не добавлены в каталог</div>';
    return;
  }

  let pool = calcProducts.filter(p => Number(p.quantity) > 0);
  if (noAlcohol) pool = pool.filter(p => !calcIsAlcoholic(p));

  if (!pool.length) {
    container.innerHTML = '<div class="calc-suggest__empty">Нет подходящих товаров</div>';
    return;
  }

  let list = [];
  const title = document.createElement('div');
  title.className = 'calc-suggest__title';

  if (budget > 0) {
    const remainBudget = budget - currentTotal;
    if (remainBudget <= 0) {
      container.innerHTML = '<div class="calc-suggest__empty">Бюджет исчерпан — увеличьте бюджет или уменьшите корзину</div>';
      return;
    }
    const sorted = [...pool].sort((a, b) => a.price - b.price);
    let sum = 0;
    for (const p of sorted) {
      if (sum + p.price <= remainBudget) {
        list.push(p);
        sum += p.price;
      }
    }
    if (!list.length) list = sorted.slice(0, 3);
    title.textContent = 'Подборка под остаток бюджета (' + calcFormatPrice(remainBudget) + '):';
  } else {
    const targetCount = Math.max(4, Math.ceil(guests / 5));
    list = [...pool]
      .sort((a, b) => (b.badge ? 1 : 0) - (a.badge ? 1 : 0))
      .slice(0, targetCount);
    title.textContent = 'Рекомендуем для ' + guests + ' гостей:';
  }

  container.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'calc-suggest__grid';

  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'calc-suggest__card';

    const name = document.createElement('div');
    name.className = 'calc-suggest__name';
    name.textContent = p.name;

    const price = document.createElement('div');
    price.className = 'calc-suggest__price';
    price.textContent = calcFormatPrice(p.price);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calc-suggest__btn';
    btn.textContent = 'В корзину';
    btn.addEventListener('click', () => {
      addToCart(p, 1);
      btn.textContent = 'Добавлено ✓';
      btn.classList.add('is-added');
      setTimeout(() => {
        btn.textContent = 'В корзину';
        btn.classList.remove('is-added');
      }, 1200);
      calcRecalc();
    });

    card.appendChild(name);
    card.appendChild(price);
    card.appendChild(btn);
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

function renderCalcFeatured() {
  const container = document.getElementById('calcFeatured');
  if (!container) return;

  if (!calcProducts.length) {
    container.innerHTML = '<div class="calc-suggest__empty">Товары ещё не добавлены в каталог</div>';
    return;
  }

  container.innerHTML = '';

  const featured = calcProducts
    .filter(p => Number(p.quantity) > 0)
    .sort((a, b) => (b.badge ? 1 : 0) - (a.badge ? 1 : 0))
    .slice(0, 8);

  if (!featured.length) {
    container.innerHTML = '<div class="calc-suggest__empty">Нет товаров в наличии</div>';
    return;
  }

  featured.forEach(p => {
    const card = document.createElement('div');
    card.className = 'calc-suggest__card';

    const name = document.createElement('div');
    name.className = 'calc-suggest__name';
    name.textContent = p.name;

    const price = document.createElement('div');
    price.className = 'calc-suggest__price';
    price.textContent = calcFormatPrice(p.price);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calc-suggest__btn';
    btn.textContent = 'В корзину';
    btn.addEventListener('click', () => {
      addToCart(p, 1);
      btn.textContent = 'Добавлено ✓';
      btn.classList.add('is-added');
      setTimeout(() => {
        btn.textContent = 'В корзину';
        btn.classList.remove('is-added');
      }, 1200);
      calcRecalc();
    });

    card.appendChild(name);
    card.appendChild(price);
    card.appendChild(btn);
    container.appendChild(card);
  });
}

function calcApplySettings(settings) {
  if (!settings || !settings.calc) return;

  const c = settings.calc;
  calcSettings.serviceFee = Number(c.serviceFee) || 0;
  calcSettings.minGuests = Number(c.minGuests) || 5;
  calcSettings.maxGuests = Number(c.maxGuests) || 100;
  calcSettings.minHours = Number(c.minHours) || 1;
  calcSettings.maxHours = Number(c.maxHours) || 12;
  calcSettings.eventMultipliers = c.eventMultipliers || calcSettings.eventMultipliers;

  const guestsEl = document.getElementById('calcGuests');
  const hoursEl = document.getElementById('calcHours');
  const minGuestsLabel = document.getElementById('minGuestsLabel');
  const maxGuestsLabel = document.getElementById('maxGuestsLabel');
  const minHoursLabel = document.getElementById('minHoursLabel');
  const maxHoursLabel = document.getElementById('maxHoursLabel');
  const feeLabel = document.getElementById('resFeePct');

  if (guestsEl) {
    guestsEl.min = calcSettings.minGuests;
    guestsEl.max = calcSettings.maxGuests;
    if (Number(guestsEl.value) < calcSettings.minGuests) {
      guestsEl.value = calcSettings.minGuests;
    }
    if (Number(guestsEl.value) > calcSettings.maxGuests) {
      guestsEl.value = calcSettings.maxGuests;
    }
  }

  if (hoursEl) {
    hoursEl.min = calcSettings.minHours;
    hoursEl.max = calcSettings.maxHours;
    if (Number(hoursEl.value) < calcSettings.minHours) {
      hoursEl.value = calcSettings.minHours;
    }
    if (Number(hoursEl.value) > calcSettings.maxHours) {
      hoursEl.value = calcSettings.maxHours;
    }
  }

  if (minGuestsLabel) minGuestsLabel.textContent = calcSettings.minGuests;
  if (maxGuestsLabel) maxGuestsLabel.textContent = calcSettings.maxGuests;
  if (minHoursLabel) minHoursLabel.textContent = calcSettings.minHours;
  if (maxHoursLabel) maxHoursLabel.textContent = calcSettings.maxHours;
  if (feeLabel) feeLabel.textContent = calcSettings.serviceFee;
}

async function initCalc() {
  const calcRoot = document.querySelector('.calc-layout');
  if (!calcRoot) return;

  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    calcProducts = Array.isArray(data.products) ? data.products : [];
    calcApplySettings(data.settings);

    calcReady = true;

    renderCalcFeatured();
    calcRecalc();

    const guestsEl = document.getElementById('calcGuests');
    const hoursEl = document.getElementById('calcHours');
    const budgetEl = document.getElementById('calcBudget');
    const eventEl = document.getElementById('calcEventType');
    const noAlcoholEl = document.getElementById('calcNoAlcohol');

    [guestsEl, hoursEl, budgetEl].forEach(el => {
      if (el) el.addEventListener('input', calcRecalc);
    });

    if (eventEl) eventEl.addEventListener('change', calcRecalc);
    if (noAlcoholEl) noAlcoholEl.addEventListener('change', calcRecalc);

    document.addEventListener('cart:updated', calcRecalc);

    const resetBtn = document.getElementById('calcResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Очистить корзину калькулятора?')) {
          clearCart();
          calcRecalc();
        }
      });
    }

    const checkoutBtn = document.getElementById('calcCheckoutBtn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', async () => {
        const cart = getCart();
        if (!cart.length) {
          alert('Корзина пуста — добавьте товары');
          return;
        }

        const guests = calcClamp(guestsEl.value, calcSettings.minGuests, calcSettings.maxGuests);
        const hours = calcClamp(hoursEl.value, calcSettings.minHours, calcSettings.maxHours);
        const budget = Number(budgetEl.value) || 0;
        const eventType = eventEl.value;
        const noAlcohol = noAlcoholEl.checked;

        const multiplier = calcEventMultiplier(eventType);
        const subtotal = calcGetCartTotal() * multiplier;
        const fee = subtotal * (calcSettings.serviceFee / 100);
        const total = subtotal + fee;

        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Оформляем…';

        try {
          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: cart,
              subtotal: subtotal,
              serviceFee: fee,
              total: total,
              guests: guests,
              hours: hours,
              eventType: eventType,
              noAlcohol: noAlcohol,
              budget: budget
            })
          });

          if (!res.ok) throw new Error('HTTP ' + res.status);

          const data = await res.json();
          alert('Заказ №' + data.orderId + ' оформлен!\nСумма: ' + calcFormatPrice(total));
          clearCart();
          calcRecalc();
        } catch (err) {
          console.error('Ошибка оформления заказа:', err);
          alert('Не удалось оформить заказ. Попробуйте позже.');
        } finally {
          checkoutBtn.disabled = false;
          checkoutBtn.textContent = 'Оформить заказ';
        }
      });
    }
  } catch (err) {
    console.error('Ошибка загрузки данных калькулятора:', err);
  }
}

document.addEventListener('DOMContentLoaded', initCalc);