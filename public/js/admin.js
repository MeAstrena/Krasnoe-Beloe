function editRow(id) {
  const row = document.querySelector('tr[data-id="' + id + '"]');
  if (!row) return;
  row.classList.add('is-editing');
}

function cancelEdit(id) {
  const row = document.querySelector('tr[data-id="' + id + '"]');
  if (!row) return;
  row.classList.remove('is-editing');
}

function initTableSearch() {
  const search = document.getElementById('tableSearch');
  const table = document.getElementById('dataTable');
  const countEl = document.getElementById('searchCount');
  if (!search || !table) return;

  const rows = Array.from(table.querySelectorAll('tbody tr'));
  const total = rows.length;

  function updateCount(visible) {
    if (!countEl) return;
    if (visible === total) {
      countEl.textContent = 'Всего: ' + total;
    } else {
      countEl.textContent = 'Найдено: ' + visible + ' из ' + total;
    }
  }

  function applyFilter() {
    const q = search.value.trim().toLowerCase();
    let visible = 0;

    rows.forEach(row => {
      const fullText = row.textContent.toLowerCase();
      const match = !q || fullText.includes(q);
      row.style.display = match ? '' : 'none';
      if (match) visible++;
    });

    updateCount(visible);
  }

  search.addEventListener('input', applyFilter);
  updateCount(total);
}

function initAlerts() {
  const alerts = document.querySelectorAll('.admin-alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.4s';
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 400);
    }, 4000);
  });
}

async function uploadPartnerLogo(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/admin/upload/partner', {
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

function initPartnerLogoUpload() {
  const fileInput = document.getElementById('newPartnerLogoFile');
  const hiddenInput = document.getElementById('newPartnerLogo');
  const preview = document.getElementById('newPartnerLogoPreview');
  if (!fileInput || !hiddenInput || !preview) return;

  const img = preview.querySelector('img');

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    try {
      const url = await uploadPartnerLogo(file);
      hiddenInput.value = url;
      img.src = url;
      preview.style.display = 'flex';
    } catch (err) {
      alert('Не удалось загрузить логотип: ' + err.message);
      fileInput.value = '';
    }
  });
}

function clearNewPartnerLogo() {
  const fileInput = document.getElementById('newPartnerLogoFile');
  const hiddenInput = document.getElementById('newPartnerLogo');
  const preview = document.getElementById('newPartnerLogoPreview');
  if (fileInput) fileInput.value = '';
  if (hiddenInput) hiddenInput.value = '';
  if (preview) {
    preview.style.display = 'none';
    const img = preview.querySelector('img');
    if (img) img.src = '';
  }
}

function initEditPartnerLogos() {
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
        const url = await uploadPartnerLogo(file);
        hiddenInput.value = url;
        img.src = url;
        preview.style.display = 'flex';
      } catch (err) {
        alert('Не удалось загрузить логотип: ' + err.message);
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
  initTableSearch();
  initAlerts();
  initPartnerLogoUpload();
  initEditPartnerLogos();
});