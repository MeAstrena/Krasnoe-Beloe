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

function initNewLogoUpload() {
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

function initEditLogoUploads() {
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
  initNewLogoUpload();
  initEditLogoUploads();
});