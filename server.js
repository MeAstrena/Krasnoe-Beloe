import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureFile(file, defaultData = []) {
  const filePath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

ensureFile('cities.json', []);
ensureFile('categories.json', []);
ensureFile('shops.json', []);
ensureFile('products.json', []);
ensureFile('orders.json', []);
ensureFile('regions.json', []);
ensureFile('partners.json', []);
ensureFile('stocks.json', []);
ensureFile('managers.json', []);
ensureFile('settings.json', {
  calc: {
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
  }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(PUBLIC_DIR));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'default-insecure-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000
  }
}));

function readData(file) {
  const filePath = path.join(DATA_DIR, file);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Ошибка чтения ${file}:`, err.message);
    return null;
  }
}

function writeData(file, data) {
  const filePath = path.join(DATA_DIR, file);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Ошибка записи ${file}:`, err.message);
    return false;
  }
}

function nextId(items) {
  if (!items || !items.length) return 1;
  return Math.max(...items.map(i => Number(i.id) || 0)) + 1;
}

function sortByName(items, field = 'name') {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) =>
    String(a[field] || '').localeCompare(String(b[field] || ''), 'ru')
  );
}

const BADGE_LABELS = {
  'hit': 'ХИТ',
  'discount': '-20%',
  'new': 'НОВИНКА',
  'sale': 'SALE',
  '1+1': '1+1',
  '': ''
};

function badgeLabel(code) {
  return BADGE_LABELS[code] || '';
}

function normalizeValue(type, value) {
  let num = Number(value) || 0;
  if (type === 'piece') {
    num = Math.max(1, Math.round(num));
  } else {
    num = Math.max(0, num);
  }
  return num;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

function requireAuthApi(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Не авторизован' });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/catalog.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'catalog.html'));
});

app.get('/calc.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'calc.html'));
});

app.get('/category.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'category.html'));
});

app.get('/cart.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'cart.html'));
});

app.get('/delivery.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'delivery.html'));
});

app.get('/api/data', (req, res) => {
  const settings = readData('settings.json') || { calc: {} };
  const products = readData('products.json') || [];
  const productsWithBadge = products.map(p => ({
    ...p,
    badgeLabel: badgeLabel(p.badge)
  }));

  res.json({
    cities: sortByName(readData('cities.json') || []),
    categories: sortByName(readData('categories.json') || []),
    shops: readData('shops.json') || [],
    products: productsWithBadge,
    regions: sortByName(readData('regions.json') || []),
    partners: readData('partners.json') || [],
    settings: settings
  });
});

app.post('/api/orders', (req, res) => {
  const { items, subtotal, serviceFee, total, guests, hours, eventType, noAlcohol, budget, shopId } = req.body;

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Корзина пуста' });
  }

  const orders = readData('orders.json') || [];
  const order = {
    id: nextId(orders),
    items: items.map(i => ({
      id: i.id,
      name: i.name,
      price: Number(i.price) || 0,
      qty: Number(i.qty) || 1
    })),
    subtotal: Number(subtotal) || 0,
    serviceFee: Number(serviceFee) || 0,
    total: Number(total) || 0,
    guests: Number(guests) || 0,
    hours: Number(hours) || 0,
    eventType: eventType || '',
    noAlcohol: !!noAlcohol,
    budget: Number(budget) || 0,
    shopId: Number(shopId) || null,
    createdAt: new Date().toISOString()
  };

  orders.push(order);
  writeData('orders.json', orders);

  res.json({ ok: true, orderId: order.id });
});

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin');
  }
  res.render('admin-login', { error: null, login: '' });
});

app.post('/admin/login', async (req, res) => {
  const { login, password } = req.body;
  const ownerLogin = process.env.OWNER_LOGIN;
  const ownerHash = process.env.OWNER_PASSWORD_HASH;

  if (!ownerLogin || !ownerHash) {
    return res.render('admin-login', {
      error: 'Владелец не настроен на сервере',
      login: login || ''
    });
  }

  if (!login || !password) {
    return res.render('admin-login', {
      error: 'Введите логин и пароль',
      login: login || ''
    });
  }

  const loginMatch = login.trim().toLowerCase() === ownerLogin.trim().toLowerCase();

  if (!loginMatch) {
    return res.render('admin-login', {
      error: 'Неверный логин или пароль',
      login: login
    });
  }

  try {
    const ok = await bcrypt.compare(password, ownerHash);
    if (!ok) {
      return res.render('admin-login', {
        error: 'Неверный логин или пароль',
        login: login
      });
    }
    req.session.isAdmin = true;
    req.session.role = 'owner';
    req.session.userLogin = ownerLogin;
    return res.redirect('/admin');
  } catch (err) {
    console.error('Ошибка проверки пароля:', err.message);
    return res.render('admin-login', {
      error: 'Ошибка сервера',
      login: login || ''
    });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/admin/login');
  });
});

app.get('/admin', requireAuth, (req, res) => {
  const orders = readData('orders.json') || [];
  res.render('admin-dashboard', {
    cities: (readData('cities.json') || []).length,
    categories: (readData('categories.json') || []).length,
    shops: (readData('shops.json') || []).length,
    products: (readData('products.json') || []).length,
    regions: (readData('regions.json') || []).length,
    partners: (readData('partners.json') || []).length,
    orders: orders.length
  });
});

/* ---------- РЕГИОНЫ ---------- */

app.get('/admin/regions', requireAuth, (req, res) => {
  res.render('admin-regions', {
    regions: sortByName(readData('regions.json') || []),
    error: req.query.error || null
  });
});

app.post('/admin/regions', requireAuth, (req, res) => {
  const { name, markup } = req.body;
  if (!name || !name.trim()) return res.redirect('/admin/regions');

  const regions = readData('regions.json') || [];
  const normalized = name.trim().toLowerCase();
  const exists = regions.some(r => r.name.toLowerCase() === normalized);

  if (exists) {
    return res.redirect('/admin/regions?error=' + encodeURIComponent('Регион «' + name.trim() + '» уже есть'));
  }

  regions.push({
    id: nextId(regions),
    name: name.trim(),
    markup: Number(markup) || 0
  });

  writeData('regions.json', regions);
  res.redirect('/admin/regions');
});

app.post('/admin/regions/:id/edit', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { name, markup } = req.body;
  if (!name || !name.trim()) return res.redirect('/admin/regions');

  const regions = readData('regions.json') || [];
  const normalized = name.trim().toLowerCase();
  const duplicate = regions.some(r => r.id !== id && r.name.toLowerCase() === normalized);

  if (duplicate) {
    return res.redirect('/admin/regions?error=' + encodeURIComponent('Регион «' + name.trim() + '» уже есть'));
  }

  const updated = regions.map(r =>
    r.id === id ? { ...r, name: name.trim(), markup: Number(markup) || 0 } : r
  );

  writeData('regions.json', updated);
  res.redirect('/admin/regions');
});

app.post('/admin/regions/:id/delete', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  writeData('regions.json', (readData('regions.json') || []).filter(r => r.id !== id));

  const cities = readData('cities.json') || [];
  const updatedCities = cities.map(c =>
    Number(c.regionId) === id ? { ...c, regionId: null } : c
  );
  writeData('cities.json', updatedCities);

  res.redirect('/admin/regions');
});

/* ---------- ПАРТНЁРЫ ДОСТАВКИ ---------- */

app.get('/admin/partners', requireAuth, (req, res) => {
  res.render('admin-partners', {
    partners: readData('partners.json') || [],
    error: req.query.error || null
  });
});

app.post('/admin/partners', requireAuth, (req, res) => {
  const { name, description, url, logo } = req.body;
  if (!name || !name.trim()) return res.redirect('/admin/partners');

  const partners = readData('partners.json') || [];
  partners.push({
    id: nextId(partners),
    name: name.trim(),
    description: (description && description.trim()) || '',
    url: (url && url.trim()) || '',
    logo: (logo && logo.trim()) || ''
  });

  writeData('partners.json', partners);
  res.redirect('/admin/partners');
});

app.post('/admin/partners/:id/edit', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { name, description, url, logo } = req.body;
  if (!name || !name.trim()) return res.redirect('/admin/partners');

  const partners = readData('partners.json') || [];
  const updated = partners.map(p =>
    p.id === id
      ? {
          ...p,
          name: name.trim(),
          description: (description && description.trim()) || '',
          url: (url && url.trim()) || '',
          logo: (logo && logo.trim()) || ''
        }
      : p
  );

  writeData('partners.json', updated);
  res.redirect('/admin/partners');
});

app.post('/admin/partners/:id/delete', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  writeData('partners.json', (readData('partners.json') || []).filter(p => p.id !== id));
  res.redirect('/admin/partners');
});

/* ---------- ГОРОДА ---------- */

app.get('/admin/cities', requireAuth, (req, res) => {
  const cities = sortByName(readData('cities.json') || []);
  const regions = sortByName(readData('regions.json') || []);

  const citiesWithRegion = cities.map(c => {
    const region = regions.find(r => Number(r.id) === Number(c.regionId));
    return { ...c, regionName: region ? region.name : '—' };
  });

  res.render('admin-cities', {
    cities: citiesWithRegion,
    regions,
    error: req.query.error || null
  });
});

app.post('/admin/cities', requireAuth, (req, res) => {
  const { name, shopsCount, regionId } = req.body;
  if (!name || !name.trim()) return res.redirect('/admin/cities');

  const cities = readData('cities.json') || [];
  const normalized = name.trim().toLowerCase();
  const exists = cities.some(c => c.name.toLowerCase() === normalized);

  if (exists) {
    return res.redirect('/admin/cities?error=' + encodeURIComponent('Город «' + name.trim() + '» уже есть в списке'));
  }

  cities.push({
    id: nextId(cities),
    name: name.trim(),
    regionId: regionId ? Number(regionId) : null,
    shops: Number(shopsCount) || 0,
    stores: []
  });

  writeData('cities.json', cities);
  res.redirect('/admin/cities');
});

app.post('/admin/cities/:id/edit', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { name, shopsCount, regionId } = req.body;
  if (!name || !name.trim()) return res.redirect('/admin/cities');

  const cities = readData('cities.json') || [];
  const normalized = name.trim().toLowerCase();
  const duplicate = cities.some(c => c.id !== id && c.name.toLowerCase() === normalized);

  if (duplicate) {
    return res.redirect('/admin/cities?error=' + encodeURIComponent('Город «' + name.trim() + '» уже есть в списке'));
  }

  const updated = cities.map(c =>
    c.id === id
      ? {
          ...c,
          name: name.trim(),
          regionId: regionId ? Number(regionId) : null,
          shops: Number(shopsCount) || 0
        }
      : c
  );

  writeData('cities.json', updated);
  res.redirect('/admin/cities');
});

app.post('/admin/cities/:id/delete', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  writeData('cities.json', (readData('cities.json') || []).filter(c => c.id !== id));
  writeData('shops.json', (readData('shops.json') || []).filter(s => Number(s.cityId) !== id));
  res.redirect('/admin/cities');
});

/* ---------- КАТЕГОРИИ ---------- */

app.get('/admin/categories', requireAuth, (req, res) => {
  res.render('admin-categories', {
    categories: sortByName(readData('categories.json') || []),
    error: req.query.error || null
  });
});

app.post('/admin/categories', requireAuth, (req, res) => {
  const { name, slug, count } = req.body;
  if (!name || !name.trim()) return res.redirect('/admin/categories');

  const categories = readData('categories.json') || [];
  const normalized = name.trim().toLowerCase();
  const exists = categories.some(c => c.name.toLowerCase() === normalized);

  if (exists) {
    return res.redirect('/admin/categories?error=' + encodeURIComponent('Категория «' + name.trim() + '» уже есть'));
  }

  const generatedSlug = (slug && slug.trim())
    ? slug.trim().toLowerCase()
    : name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  categories.push({
    id: nextId(categories),
    name: name.trim(),
    slug: generatedSlug,
    count: Number(count) || 0
  });

  writeData('categories.json', categories);
  res.redirect('/admin/categories');
});

app.post('/admin/categories/:id/edit', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { name, slug, count } = req.body;
  if (!name || !name.trim()) return res.redirect('/admin/categories');

  const categories = readData('categories.json') || [];
  const normalized = name.trim().toLowerCase();
  const duplicate = categories.some(c => c.id !== id && c.name.toLowerCase() === normalized);

  if (duplicate) {
    return res.redirect('/admin/categories?error=' + encodeURIComponent('Категория «' + name.trim() + '» уже есть'));
  }

  const updated = categories.map(c =>
    c.id === id
      ? {
          ...c,
          name: name.trim(),
          slug: (slug && slug.trim()) || c.slug,
          count: Number(count) || 0
        }
      : c
  );

  writeData('categories.json', updated);
  res.redirect('/admin/categories');
});

app.post('/admin/categories/:id/delete', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  writeData('categories.json', (readData('categories.json') || []).filter(c => c.id !== id));
  res.redirect('/admin/categories');
});

/* ---------- МАГАЗИНЫ ---------- */

app.get('/admin/shops', requireAuth, (req, res) => {
  const shops = readData('shops.json') || [];
  const cities = sortByName(readData('cities.json') || []);

  const shopsWithCity = shops.map(s => {
    const city = cities.find(c => Number(c.id) === Number(s.cityId));
    return { ...s, cityName: city ? city.name : '—' };
  });

  shopsWithCity.sort((a, b) => {
    const byCity = a.cityName.localeCompare(b.cityName, 'ru');
    if (byCity !== 0) return byCity;
    return a.address.localeCompare(b.address, 'ru');
  });

  res.render('admin-shops', { cities, shops: shopsWithCity, error: req.query.error || null });
});

app.post('/admin/shops', requireAuth, (req, res) => {
  const { cityId, address, metro, hoursFrom, hoursTo } = req.body;

  if (!cityId || !address || !address.trim()) return res.redirect('/admin/shops');
  if (!hoursFrom || !hoursTo) return res.redirect('/admin/shops');

  const shops = readData('shops.json') || [];
  const normalized = address.trim().toLowerCase();
  const exists = shops.some(s =>
    Number(s.cityId) === Number(cityId) && s.address.toLowerCase() === normalized
  );

  if (exists) {
    return res.redirect('/admin/shops?error=' + encodeURIComponent('Такой магазин уже есть в этом городе'));
  }

  shops.push({
    id: nextId(shops),
    cityId: Number(cityId),
    address: address.trim(),
    metro: (metro && metro.trim()) || '',
    hours: `${hoursFrom}–${hoursTo}`
  });

  writeData('shops.json', shops);
  res.redirect('/admin/shops');
});

app.post('/admin/shops/:id/edit', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { cityId, address, metro, hoursFrom, hoursTo } = req.body;

  if (!cityId || !address || !address.trim()) return res.redirect('/admin/shops');
  if (!hoursFrom || !hoursTo) return res.redirect('/admin/shops');

  const shops = readData('shops.json') || [];
  const normalized = address.trim().toLowerCase();
  const duplicate = shops.some(s =>
    s.id !== id &&
    Number(s.cityId) === Number(cityId) &&
    s.address.toLowerCase() === normalized
  );

  if (duplicate) {
    return res.redirect('/admin/shops?error=' + encodeURIComponent('Такой магазин уже есть в этом городе'));
  }

  const updated = shops.map(s =>
    s.id === id
      ? {
          ...s,
          cityId: Number(cityId),
          address: address.trim(),
          metro: (metro && metro.trim()) || '',
          hours: `${hoursFrom}–${hoursTo}`
        }
      : s
  );

  writeData('shops.json', updated);
  res.redirect('/admin/shops');
});

app.post('/admin/shops/:id/delete', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  writeData('shops.json', (readData('shops.json') || []).filter(s => s.id !== id));
  res.redirect('/admin/shops');
});

/* ---------- ТОВАРЫ ---------- */

app.get('/admin/products', requireAuth, (req, res) => {
  const products = readData('products.json') || [];
  const categories = sortByName(readData('categories.json') || []);

  const productsWithCat = products.map(p => {
    const cat = categories.find(c => Number(c.id) === Number(p.categoryId));
    return {
      ...p,
      categoryName: cat ? cat.name : '—',
      badgeLabel: badgeLabel(p.badge)
    };
  });

  productsWithCat.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  res.render('admin-products', {
    categories,
    products: productsWithCat,
    badgeOptions: [
      { value: '', label: 'Без бейджа' },
      { value: 'hit', label: 'Хит → ХИТ' },
      { value: 'discount', label: '-20% → -20%' },
      { value: 'new', label: 'Новинка → НОВИНКА' },
      { value: 'sale', label: 'SALE → SALE' },
      { value: '1+1', label: '1+1 → 1+1' }
    ],
    error: req.query.error || null
  });
});

app.post('/admin/products', requireAuth, (req, res) => {
  const {
    name, categoryId, brand, price, oldPrice,
    type, value, weight, badge
  } = req.body;

  if (!name || !name.trim()) return res.redirect('/admin/products');
  if (!categoryId) return res.redirect('/admin/products');
  if (!price || isNaN(Number(price))) return res.redirect('/admin/products');
  if (type !== 'weight' && type !== 'piece') return res.redirect('/admin/products');

  const products = readData('products.json') || [];
  const normalized = name.trim().toLowerCase();
  const exists = products.some(p =>
    p.name.toLowerCase() === normalized && Number(p.categoryId) === Number(categoryId)
  );

  if (exists) {
    return res.redirect('/admin/products?error=' + encodeURIComponent('Такой товар уже есть в этой категории'));
  }

  const numValue = normalizeValue(type, value);

  products.push({
    id: nextId(products),
    name: name.trim(),
    categoryId: Number(categoryId),
    brand: (brand && brand.trim()) || '',
    price: Number(price),
    oldPrice: oldPrice ? Number(oldPrice) : null,
    type: type,
    unit: type === 'weight' ? 'кг' : 'шт',
    weight: (weight && weight.trim()) || '',
    value: numValue,
    quantity: numValue,
    badge: badge || ''
  });

  writeData('products.json', products);
  res.redirect('/admin/products');
});

app.post('/admin/products/:id/edit', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const {
    name, categoryId, brand, price, oldPrice,
    type, value, weight, badge
  } = req.body;

  if (!name || !name.trim()) return res.redirect('/admin/products');
  if (!categoryId) return res.redirect('/admin/products');
  if (!price || isNaN(Number(price))) return res.redirect('/admin/products');
  if (type !== 'weight' && type !== 'piece') return res.redirect('/admin/products');

  const products = readData('products.json') || [];
  const normalized = name.trim().toLowerCase();
  const duplicate = products.some(p =>
    p.id !== id &&
    p.name.toLowerCase() === normalized &&
    Number(p.categoryId) === Number(categoryId)
  );

  if (duplicate) {
    return res.redirect('/admin/products?error=' + encodeURIComponent('Такой товар уже есть в этой категории'));
  }

  const numValue = normalizeValue(type, value);

  const updated = products.map(p =>
    p.id === id
      ? {
          ...p,
          name: name.trim(),
          categoryId: Number(categoryId),
          brand: (brand && brand.trim()) || '',
          price: Number(price),
          oldPrice: oldPrice ? Number(oldPrice) : null,
          type: type,
          unit: type === 'weight' ? 'кг' : 'шт',
          weight: (weight && weight.trim()) || '',
          value: numValue,
          quantity: numValue,
          badge: badge || ''
        }
      : p
  );

  writeData('products.json', updated);
  res.redirect('/admin/products');
});

app.post('/admin/products/:id/delete', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  writeData('products.json', (readData('products.json') || []).filter(p => p.id !== id));
  res.redirect('/admin/products');
});

/* ---------- НАСТРОЙКИ КАЛЬКУЛЯТОРА ---------- */

app.get('/admin/calc-settings', requireAuth, (req, res) => {
  const settings = readData('settings.json') || { calc: {} };
  res.render('admin-calc-settings', {
    calc: settings.calc || {},
    error: req.query.error || null
  });
});

app.post('/admin/calc-settings', requireAuth, (req, res) => {
  const {
    serviceFee, minGuests, maxGuests, minHours, maxHours,
    wedding, corporate, birthday, party
  } = req.body;

  const settings = {
    calc: {
      serviceFee: Number(serviceFee) || 0,
      minGuests: Number(minGuests) || 5,
      maxGuests: Number(maxGuests) || 100,
      minHours: Number(minHours) || 1,
      maxHours: Number(maxHours) || 12,
      eventMultipliers: {
        wedding: Number(wedding) || 0,
        corporate: Number(corporate) || 0,
        birthday: Number(birthday) || 0,
        party: Number(party) || 0
      }
    }
  };

  writeData('settings.json', settings);
  res.redirect('/admin/calc-settings');
});

/* ---------- ЗАКАЗЫ ---------- */

app.get('/admin/orders', requireAuth, (req, res) => {
  const orders = readData('orders.json') || [];
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.render('admin-orders', { orders });
});

app.post('/admin/orders/:id/delete', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  writeData('orders.json', (readData('orders.json') || []).filter(o => o.id !== id));
  res.redirect('/admin/orders');
});

/* ---------- API АДМИНКИ ---------- */

app.get('/api/admin/cities', requireAuthApi, (req, res) => res.json(sortByName(readData('cities.json') || [])));
app.get('/api/admin/categories', requireAuthApi, (req, res) => res.json(sortByName(readData('categories.json') || [])));
app.get('/api/admin/shops', requireAuthApi, (req, res) => res.json(readData('shops.json') || []));
app.get('/api/admin/products', requireAuthApi, (req, res) => res.json(readData('products.json') || []));
app.get('/api/admin/regions', requireAuthApi, (req, res) => res.json(readData('regions.json') || []));
app.get('/api/admin/partners', requireAuthApi, (req, res) => res.json(readData('partners.json') || []));
app.get('/api/admin/settings', requireAuthApi, (req, res) => res.json(readData('settings.json') || {}));
app.get('/api/admin/orders', requireAuthApi, (req, res) => res.json(readData('orders.json') || []));

app.use((req, res) => {
  res.status(404).send('404 — Страница не найдена. <a href="/">На главную</a>');
});

app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(500).send('Внутренняя ошибка сервера');
});

app.listen(PORT, () => {
  console.log('');
  console.log('  Красное&Белое — сервер запущен');
  console.log(`  Сайт:     http://localhost:${PORT}`);
  console.log(`  Админка:  http://localhost:${PORT}/admin`);
  console.log('');
  if (!process.env.OWNER_LOGIN || !process.env.OWNER_PASSWORD_HASH) {
    console.log('  ВНИМАНИЕ: OWNER_LOGIN или OWNER_PASSWORD_HASH не заданы в .env');
    console.log('  Вход в админку невозможен.');
    console.log('');
  }
  if (!process.env.SESSION_SECRET) {
    console.log('  ВНИМАНИЕ: SESSION_SECRET не задан в .env');
    console.log('');
  }
});