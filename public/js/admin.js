function editRow(id) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;
  row.classList.add('is-editing');
}

function cancelEdit(id) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
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
      countEl.textContent = `Всего: ${total}`;
    } else {
      countEl.textContent = `Найдено: ${visible} из ${total}`;
    }
  }

  function applyFilter() {
    const q = search.value.trim().toLowerCase();
    let visible = 0;

    rows.forEach(row => {
      const text = row.querySelector('.row-view')?.textContent?.toLowerCase() || '';
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

document.addEventListener('DOMContentLoaded', () => {
  initTableSearch();
  initAlerts();
});