function applyTypeToInput(input, type) {
  if (!input) return;

  if (type === 'piece') {
    input.step = '1';
    input.min = '0';
    input.placeholder = 'Количество (шт)';

    const current = parseFloat(input.value);
    if (!isNaN(current) && current >= 0) {
      input.value = Math.round(current);
    } else {
      input.value = 0;
    }
  } else {
    input.step = '0.01';
    input.min = '0';
    input.placeholder = 'Количество (кг)';

    const current = parseFloat(input.value);
    if (isNaN(current) || current < 0) {
      input.value = 0;
    }
  }
}

function initNewProductTypeSwitch() {
  const form = document.querySelector('form[action="/admin/products"]');
  if (!form) return;

  const radios = form.querySelectorAll('input[name="type"]');
  const valueInput = form.querySelector('#newProductValue');
  if (!radios.length || !valueInput) return;

  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      applyTypeToInput(valueInput, radio.value);
    });
  });

  const checked = form.querySelector('input[name="type"]:checked');
  applyTypeToInput(valueInput, checked ? checked.value : 'weight');
}

function initEditTypeSwitches() {
  const rows = document.querySelectorAll('tr[data-id]');

  rows.forEach(row => {
    const radios = row.querySelectorAll('.edit-type');
    const valueInput = row.querySelector('.edit-value');
    if (!radios.length || !valueInput) return;

    radios.forEach(radio => {
      radio.addEventListener('change', () => {
        applyTypeToInput(valueInput, radio.value);
      });
    });

    const checked = row.querySelector('.edit-type:checked');
    applyTypeToInput(valueInput, checked ? checked.value : 'weight');
  });
}

function toggleDiscountInput(select, input) {
  if (!select || !input) return;
  if (select.value === 'discount') {
    input.style.display = 'inline-block';
  } else {
    input.style.display = 'none';
    input.value = '';
  }
}

function initNewProductBadgeSwitch() {
  const form = document.querySelector('form[action="/admin/products"]');
  if (!form) return;

  const select = form.querySelector('.badge-select');
  const discountInput = form.querySelector('.discount-input');
  if (!select || !discountInput) return;

  select.addEventListener('change', () => {
    toggleDiscountInput(select, discountInput);
  });

  toggleDiscountInput(select, discountInput);
}

function initEditBadgeSwitches() {
  const rows = document.querySelectorAll('tr[data-id]');

  rows.forEach(row => {
    const select = row.querySelector('.badge-select');
    const discountInput = row.querySelector('.discount-input');
    if (!select || !discountInput) return;

    select.addEventListener('change', () => {
      toggleDiscountInput(select, discountInput);
    });
  });
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/admin/upload/image', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка загрузки');
  }

  const data = await res.json();
  return data.url;
}

function initNewImageUpload() {
  const fileInput = document.getElementById('newProductImageFile');
  const hiddenInput = document.getElementById('newProductImage');
  const preview = document.getElementById('newProductImagePreview');
  if (!fileInput || !hiddenInput || !preview) return;

  const img = preview.querySelector('img');

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    try {
      const url = await uploadImage(file);
      hiddenInput.value = url;
      img.src = url;
      preview.style.display = 'flex';
    } catch (err) {
      alert('Не удалось загрузить картинку: ' + err.message);
      fileInput.value = '';
    }
  });
}

function clearNewImage() {
  const fileInput = document.getElementById('newProductImageFile');
  const hiddenInput = document.getElementById('newProductImage');
  const preview = document.getElementById('newProductImagePreview');
  if (fileInput) fileInput.value = '';
  if (hiddenInput) hiddenInput.value = '';
  if (preview) {
    preview.style.display = 'none';
    const img = preview.querySelector('img');
    if (img) img.src = '';
  }
}

function initEditImageUploads() {
  const rows = document.querySelectorAll('tr[data-id]');

  rows.forEach(row => {
    const fileInput = row.querySelector('.edit-image-file');
    const hiddenInput = row.querySelector('.edit-image-input');
    const preview = row.querySelector('[data-preview]');
    if (!fileInput || !hiddenInput || !preview) return;

    const img = preview.querySelector('img');
    const clearBtn = preview.querySelector('.edit-image-clear');

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      try {
        const url = await uploadImage(file);
        hiddenInput.value = url;
        img.src = url;
        preview.style.display = 'flex';
      } catch (err) {
        alert('Не удалось загрузить картинку: ' + err.message);
        fileInput.value = '';
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        fileInput.value = '';
        hiddenInput.value = '';
        img.src = '';
        preview.style.display = 'none';
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNewProductTypeSwitch();
  initEditTypeSwitches();
  initNewProductBadgeSwitch();
  initEditBadgeSwitches();
  initNewImageUpload();
  initEditImageUploads();
});