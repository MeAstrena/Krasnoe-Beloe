// Мобильное меню
document.querySelector('.mobile-menu-btn')?.addEventListener('click', function() {
  document.querySelector('.nav').classList.toggle('nav--open');
});

// Фильтры в мобильной версии
const filtersBtn = document.getElementById('filtersBtn');
const filters = document.getElementById('filters');

if (filtersBtn && filters) {
  // Показываем кнопку фильтров только на мобильных
  function checkMobile() {
    if (window.innerWidth <= 768) {
      filtersBtn.style.display = 'inline-flex';
      // Показываем кнопку закрытия в фильтрах
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

  filtersBtn.addEventListener('click', function() {
    filters.classList.toggle('is-open');
  });
}

// Плавное появление карточек при скролле
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.product-card, .category-card, .quick-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// Пересчёт калькулятора (демо)
document.querySelectorAll('.calc-field__input, .calc-field__select').forEach(input => {
  input.addEventListener('change', function() {
    // Здесь можно добавить реальную логику расчёта
    console.log('Параметры изменены');
  });
});