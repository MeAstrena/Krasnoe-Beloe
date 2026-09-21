async function renderDeliveryPartners() {
  const container = document.getElementById('deliveryPartners');
  if (!container) return;

  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const partners = Array.isArray(data.partners) ? data.partners : [];

    if (!partners.length) {
      container.innerHTML = '<div class="delivery-partners__empty">Партнёры пока не добавлены</div>';
      return;
    }

    container.innerHTML = '';
    partners.forEach(p => container.appendChild(createPartnerCard(p)));
  } catch (err) {
    console.error('Не удалось загрузить партнёров доставки:', err);
    container.innerHTML = '<div class="delivery-partners__empty">Ошибка загрузки</div>';
  }
}

function createPartnerCard(partner) {
  const card = document.createElement('div');
  card.className = 'delivery-card';

  const logo = document.createElement('div');
  logo.className = 'delivery-card__logo';
  if (partner.logo) {
    const img = document.createElement('img');
    img.src = partner.logo;
    img.alt = partner.name;
    img.loading = 'lazy';
    logo.appendChild(img);
  } else {
    logo.textContent = '🚚';
  }

  const name = document.createElement('div');
  name.className = 'delivery-card__name';
  name.textContent = partner.name;

  const desc = document.createElement('div');
  desc.className = 'delivery-card__desc';
  desc.textContent = partner.description || '';

  const link = document.createElement('a');
  link.className = 'delivery-card__link';
  link.href = partner.url || '#';
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Перейти на сайт →';

  card.appendChild(logo);
  card.appendChild(name);
  if (partner.description) card.appendChild(desc);
  card.appendChild(link);

  return card;
}

document.addEventListener('DOMContentLoaded', renderDeliveryPartners);