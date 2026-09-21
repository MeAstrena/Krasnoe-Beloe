<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Админка — Товары</title>
  <link rel="stylesheet" href="/css/admin.css">
</head>
<body class="admin-page">
  <header class="admin-header">
    <div class="admin-header__logo">КБ Админка</div>
    <nav class="admin-nav">
      <a href="/admin">Обзор</a>
      <a href="/admin/regions">Регионы</a>
      <a href="/admin/cities">Города</a>
      <a href="/admin/categories">Категории</a>
      <a href="/admin/shops">Магазины</a>
      <a href="/admin/products" class="is-active">Товары</a>
      <a href="/admin/partners">Доставка</a>
      <a href="/admin/calc-settings">Калькулятор</a>
      <a href="/admin/orders">Заказы</a>
      <a href="/admin/logout" class="admin-nav__logout">Выйти</a>
    </nav>
  </header>

  <main class="admin-main">
    <h1>Товары</h1>

    <% if (error) { %>
      <div class="admin-alert"><%= error %></div>
    <% } %>

    <form class="admin-form--products" method="POST" action="/admin/products">
      <div class="admin-form-row">
        <input type="text" name="name" placeholder="Название товара" required>

        <select name="categoryId" required>
          <option value="">Категория</option>
          <% categories.forEach(cat => { %>
            <option value="<%= cat.id %>"><%= cat.name %></option>
          <% }) %>
        </select>

        <input type="text" name="brand" placeholder="Бренд">
        <input type="number" name="price" placeholder="Цена, ₽" step="0.01" min="0" required>
        <input type="number" name="oldPrice" placeholder="Старая цена, ₽" step="0.01" min="0">
        <input type="text" name="weight" placeholder="Фасовка (45 г, 0.5 л)">
      </div>

      <div class="admin-form-row">
        <div class="admin-type-switch">
          <label class="admin-radio">
            <input type="radio" name="type" value="weight" checked>
            <span>Весовой (кг)</span>
          </label>
          <label class="admin-radio">
            <input type="radio" name="type" value="piece">
            <span>Штучный (шт)</span>
          </label>
        </div>

        <input
          type="number"
          name="value"
          id="newProductValue"
          placeholder="Количество (кг)"
          step="0.01"
          min="0"
          value="0"
          required>

        <select name="badge">
          <% badgeOptions.forEach(opt => { %>
            <option value="<%= opt.value %>"><%= opt.label %></option>
          <% }) %>
        </select>

        <button type="submit">Добавить</button>
      </div>
    </form>

    <div class="admin-search">
      <input type="text" id="tableSearch" placeholder="Поиск по названию, бренду, категории...">
      <span class="admin-search__count" id="searchCount"></span>
    </div>

    <table class="admin-table" id="dataTable">
      <thead>
        <tr>
          <th>ID</th>
          <th>Название</th>
          <th>Категория</th>
          <th>Бренд</th>
          <th>Тип</th>
          <th>Кол-во</th>
          <th>Цена</th>
          <th>Бейдж</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <% products.forEach(p => { %>
          <tr data-id="<%= p.id %>">
            <td><%= p.id %></td>
            <td class="row-view"><span class="cell-name"><%= p.name %></span></td>
            <td class="row-view"><span class="cell-cat"><%= p.categoryName %></span></td>
            <td class="row-view"><span class="cell-brand"><%= p.brand || '—' %></span></td>
            <td class="row-view"><span class="cell-type"><%= p.unit || (p.type === 'piece' ? 'шт' : 'кг') %></span></td>
            <td class="row-view">
              <span class="cell-value">
                <%= p.value !== undefined ? p.value : (p.quantity || 0) %>
                <%= p.unit || (p.type === 'piece' ? 'шт' : 'кг') %>
              </span>
            </td>
            <td class="row-view">
              <span class="cell-price"><%= Number(p.price).toFixed(2) %> ₽</span>
              <% if (p.oldPrice) { %>
                <br><small style="color:#999;text-decoration:line-through"><%= Number(p.oldPrice).toFixed(2) %> ₽</small>
              <% } %>
            </td>
            <td class="row-view"><span class="cell-badge"><%= p.badgeLabel || '—' %></span></td>
            <td class="row-view admin-actions">
              <button type="button" class="admin-btn-edit" onclick="editRow(<%= p.id %>)">Изменить</button>
              <form method="POST" action="/admin/products/<%= p.id %>/delete" onsubmit="return confirm('Удалить товар <%= p.name %>?')">
                <button type="submit" class="admin-btn-delete">Удалить</button>
              </form>
            </td>

            <td class="row-edit" colspan="9">
              <form method="POST" action="/admin/products/<%= p.id %>/edit" class="admin-edit-form--products">
                <div class="admin-form-row">
                  <input type="text" name="name" value="<%= p.name %>" required>

                  <select name="categoryId" required>
                    <% categories.forEach(cat => { %>
                      <option value="<%= cat.id %>" <%= Number(cat.id) === Number(p.categoryId) ? 'selected' : '' %>><%= cat.name %></option>
                    <% }) %>
                  </select>

                  <input type="text" name="brand" value="<%= p.brand || '' %>" placeholder="Бренд">
                  <input type="number" name="price" value="<%= p.price %>" step="0.01" min="0" required>
                  <input type="number" name="oldPrice" value="<%= p.oldPrice || '' %>" step="0.01" min="0" placeholder="Старая цена">
                  <input type="text" name="weight" value="<%= p.weight || '' %>" placeholder="Фасовка">
                </div>

                <div class="admin-form-row">
                  <div class="admin-type-switch">
                    <label class="admin-radio">
                      <input type="radio" name="type" value="weight" class="edit-type" <%= (p.type || 'weight') === 'weight' ? 'checked' : '' %>>
                      <span>кг</span>
                    </label>
                    <label class="admin-radio">
                      <input type="radio" name="type" value="piece" class="edit-type" <%= p.type === 'piece' ? 'checked' : '' %>>
                      <span>шт</span>
                    </label>
                  </div>

                  <input
                    type="number"
                    name="value"
                    class="edit-value"
                    value="<%= p.value !== undefined ? p.value : (p.quantity || 0) %>"
                    step="0.01"
                    min="0"
                    required>

                  <select name="badge">
                    <% badgeOptions.forEach(opt => { %>
                      <option value="<%= opt.value %>" <%= (p.badge || '') === opt.value ? 'selected' : '' %>><%= opt.label %></option>
                    <% }) %>
                  </select>

                  <button type="submit" class="admin-btn-save">Сохранить</button>
                  <button type="button" class="admin-btn-cancel" onclick="cancelEdit(<%= p.id %>)">Отмена</button>
                </div>
              </form>
            </td>
          </tr>
        <% }) %>
      </tbody>
    </table>
  </main>

  <script src="/js/admin.js"></script>
  <script src="/js/admin-products.js"></script>
</body>
</html>