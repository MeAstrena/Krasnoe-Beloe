(function () {
  const DATA = window.PROMO_DATA || { categories: [], products: [], promos: [] };

  const allCategories = Array.isArray(DATA.categories) ? DATA.categories : [];
  const allProducts = Array.isArray(DATA.products) ? DATA.products : [];
  const allPromos = Array.isArray(DATA.promos) ? DATA.promos : [];

  function normBrand(s) {
    return String(s || '').trim();
  }

  function getBrandsByCategories(catIds) {
    const set = new Set();
    if (!catIds.length) return [];

    allProducts.forEach(p => {
      if (!catIds.includes(Number(p.categoryId))) return;
      const b = normBrand(p.brand);
      if (b) set.add(b);
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }

  function getProductsByCatsAndBrands(catIds, brandNames) {
    return allProducts.filter(p => {
      if (catIds.length && !catIds.includes(Number(p.categoryId))) return false;
      if (brandNames.length) {
        const b = normBrand(p.brand).toLowerCase();
        if (!brandNames.map(x => x.toLowerCase()).includes(b)) return false;
      }
      return true;
    });
  }

  function getSelectedValues(container, selector) {
    return Array.from(container.querySelectorAll(selector + ':checked')).map(i => i.value);
  }

  function renderBrands(containerEl, catIds, selectedBrands, brandsContainerForProducts) {
    containerEl.innerHTML = '';

    if (!catIds.length) {
      containerEl.innerHTML = '<div class="promo-cascade__empty">Сначала выберите категории</div>';
      return;
    }

    const brands = getBrandsByCategories(catIds);

    if (!brands.length) {
      containerEl.innerHTML = '<div class="promo-cascade__empty">Нет брендов в выбранных категориях</div>';
      return;
    }

    brands.forEach(brand => {
      const label = document.createElement('label');
      label.className = 'promo-check';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'brandNames';
      input.value = brand;
      input.className = 'promo-brand-checkbox';
      if (selectedBrands.includes(brand)) input.checked = true;

      const span = document.createElement('span');
      span.textContent = brand;

      label.appendChild(input);
      label.appendChild(span);
      containerEl.appendChild(label);
    });
  }

  function renderProducts(containerEl, catIds, brandNames, selectedProductIds) {
    containerEl.innerHTML = '';

    if (!catIds.length) {
      containerEl.innerHTML = '<div class="promo-cascade__empty">Сначала выберите категории</div>';
      return;
    }

    const products = getProductsByCatsAndBrands(catIds, brandNames);

    if (!products.length) {
      containerEl.innerHTML = '<div class="promo-cascade__empty">Нет товаров по выбранным фильтрам</div>';
      return;
    }

    products.forEach(p => {
      const label = document.createElement('label');
      label.className = 'promo-check';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'productIds';
      input.value = p.id;
      input.className = 'promo-product-checkbox';
      if (selectedProductIds.map(Number).includes(Number(p.id))) input.checked = true;

      const span = document.createElement('span');
      span.textContent = p.name + (p.brand ? ' (' + p.brand + ')' : '');

      label.appendChild(input);
      label.appendChild(span);
      containerEl.appendChild(label);
    });
  }

  function initNewPromoForm() {
    const form = document.getElementById('newPromoForm');
    if (!form) return;

    const catsContainer = document.getElementById('promoCategoriesNew');
    const brandsContainer = document.getElementById('promoBrandsNew');
    const productsContainer = document.getElementById('promoProductsNew');

    function refresh() {
      const catIds = getSelectedValues(catsContainer, '.promo-cat-checkbox').map(Number);

      const selectedBrands = getSelectedValues(brandsContainer, '.promo-brand-checkbox');

      renderBrands(brandsContainer, catIds, selectedBrands);

      const brandsAfterRender = getSelectedValues(brandsContainer, '.promo-brand-checkbox');

      const selectedProducts = getSelectedValues(productsContainer, '.promo-product-checkbox').map(Number);

      renderProducts(productsContainer, catIds, brandsAfterRender, selectedProducts);
    }

    catsContainer.addEventListener('change', (e) => {
      if (e.target.classList.contains('promo-cat-checkbox')) {
        refresh();
      }
    });

    brandsContainer.addEventListener('change', (e) => {
      if (e.target.classList.contains('promo-brand-checkbox')) {
        const catIds = getSelectedValues(catsContainer, '.promo-cat-checkbox').map(Number);
        const brands = getSelectedValues(brandsContainer, '.promo-brand-checkbox');
        const selectedProducts = getSelectedValues(productsContainer, '.promo-product-checkbox').map(Number);
        renderProducts(productsContainer, catIds, brands, selectedProducts);
      }
    });

    refresh();
  }

  function initEditPromoForms() {
    allPromos.forEach(promo => {
      const form = document.querySelector('form[data-promo-id="' + promo.id + '"]');
      if (!form) return;

      const catsContainer = form.querySelector('[data-promo-cats]');
      const brandsContainer = form.querySelector('[data-promo-brands]');
      const productsContainer = form.querySelector('[data-promo-products]');

      if (!catsContainer || !brandsContainer || !productsContainer) return;

      const initCatIds = (promo.categoryIds || []).map(Number);
      const initBrands = (promo.brandNames || []).map(String);
      const initProducts = (promo.productIds || []).map(Number);

      function refresh() {
        const catIds = getSelectedValues(catsContainer, '.promo-cat-checkbox').map(Number);
        const selectedBrands = getSelectedValues(brandsContainer, '.promo-brand-checkbox');
        renderBrands(brandsContainer, catIds, selectedBrands);
        const brandsAfterRender = getSelectedValues(brandsContainer, '.promo-brand-checkbox');
        const selectedProducts = getSelectedValues(productsContainer, '.promo-product-checkbox').map(Number);
        renderProducts(productsContainer, catIds, brandsAfterRender, selectedProducts);
      }

      renderBrands(brandsContainer, initCatIds, initBrands);
      renderProducts(productsContainer, initCatIds, initBrands, initProducts);

      catsContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('promo-cat-checkbox')) refresh();
      });

      brandsContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('promo-brand-checkbox')) {
          const catIds = getSelectedValues(catsContainer, '.promo-cat-checkbox').map(Number);
          const brands = getSelectedValues(brandsContainer, '.promo-brand-checkbox');
          const selectedProducts = getSelectedValues(productsContainer, '.promo-product-checkbox').map(Number);
          renderProducts(productsContainer, catIds, brands, selectedProducts);
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNewPromoForm();
    initEditPromoForms();
  });
})();