function applyTypeToInput(input, type) {
  if (!input) return;

  if (type === 'piece') {
    input.step = '1';
    input.min = '1';
    input.placeholder = 'Количество (шт)';

    const current = parseFloat(input.value);
    if (!isNaN(current) && current < 1) {
      input.value = 1;
    } else if (!isNaN(current)) {
      input.value = Math.round(current);
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

document.addEventListener('DOMContentLoaded', () => {
  initNewProductTypeSwitch();
  initEditTypeSwitches();
});