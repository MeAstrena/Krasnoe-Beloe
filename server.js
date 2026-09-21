import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PRODUCTS_UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'products');
const PARTNERS_UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'partners');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(PRODUCTS_UPLOAD_DIR)) {
  fs.mkdirSync(PRODUCTS_UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(PARTNERS_UPLOAD_DIR)) {
  fs.mkdirSync(PARTNERS_UPLOAD_DIR, { recursive: true });
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
ensureFile('promo.json', []);
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

function makeStorage(dir, prefix) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = prefix + '-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
      cb(null, name);
    }
  });
}

function makeFileFilter() {
  return (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Только jpg, png, webp, gif'));
    }
  };
}

const uploadProduct = multer({
  storage: makeStorage(PRODUCTS_UPLOAD_DIR, 'product'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: makeFileFilter()
});

const uploadPartner = multer({
  storage: makeStorage(PARTNERS_UPLOAD_DIR, 'partner'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: makeFileFilter()
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

function badgeLabel(code, discountPercent) {
  if (code === 'discount') {
    const p = Number(discountPercent) || 0;
    return p > 0 ? '-' + p + '%' : 'СКИДКА';
  }
  const map = {
    'hit': 'ХИТ',
    'new': 'НОВИНКА',
    'sale': 'SALE',
    '1+1': '1+1',
    '': ''
  };
  return map[code] || '';
}

function parseDateDDMMYYYY(str) {
  if (!str) return null;
  const parts = String(str).split('.');
  if (parts.length !== 3) return null;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  if (!day || !month || !year) return null;
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return null;
  return d;
}

function dateToInputValue(str) {
  if (!str) return '';
  const d = parseDateDDMMYYYY(str);
  if (!d) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

function inputValueToDate(str) {
  if (!str) return '';
  const parts = String(str).split('-');
  if (parts.length !== 3) return '';
  return parts[2] + '.' + parts[1] + '.' + parts[0];
}

function generatePassword(length = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, chars.length);
    pwd += chars[idx];
  }
  return pwd;
}

function getStockValue(stocks, shopId, productId) {
  const record = stocks.find(s =>
    Number(s.shopId) === Number(shopId) && Number(s.productId) === Number(productId)
  );
  if (!record) return 0;
  return Number(record.value) || 0;
}

function setStockValue(stocks, shopId, productId, value) {
  const idx = stocks.findIndex(s =>
    Number(s.shopId) === Number(shopId) && Number(s.productId) === Number(productId)
  );
  const num = Number(value) || 0;
  if (idx === -1) {
    stocks.push({ shopId: Number(shopId), productId: Number(productId), value: num });
  } else {
    stocks[idx].value = num;
  }
  return stocks;
}

function getStocksForShop(stocks, shopId) {
  const result = {};
  stocks.forEach(s => {
    if (Number(s.shopId) === Number(shopId)) {
      result[Number(s.productId)] = Number(s.value) || 0;
    }
  });
  return result;
}

function requireAuth(req, res, next) {
  if (req.session && (req.session.isAdmin || req.session.isManager)) return next();
  return res.redirect('/admin/login');
}

function requireOwner(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

function requireManager(req, res, next) {
  if (req.session && req.session.isManager && req.session.shopId) return next();
  return res.redirect('/admin/login');
}

function requireAuthApi(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Не авторизован' });
}

/* ---------- ПУБЛИЧНЫЕ РОУТЫ ---------- */

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

app.get('/delivery-order.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'delivery-order.html'));
});

app.get('/api/data', (req, res) => {
  const settings = readData('settings.json') || { calc: {} };
  const products = readData('products.json') || [];
  const stocks = readData('stocks.json') || [];
  const shops = readData('shops.json') || [];

  const productsWithBadge = products.map(p => ({
    ...p,
    badgeLabel: badgeLabel(p.badge, p.discountPercent)
  }));

  const stocksByShop = {};
  shops.forEach(shop => {
    stocksByShop[shop.id] = getStocksForShop(stocks, shop.id);
  });

  res.json({
    cities: sortByName(readData('cities.json') || []),
    categories: sortByName(readData('categories.json') || []),
    shops: shops,
    products: productsWithBadge,
    stocksByShop: stocksByShop,
    regions: sortByName(readData('regions.json') || []),
    partners: readData('partners.json') || [],
    settings: settings
  });
});

app.post('/api/promo/check', (req, res) => {
  const { code, items, subtotal } = req.body;

  if (!code || !code.trim()) {
    return res.status(400).json({ ok: false, message: 'Введите промокод' });
  }

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ ok: false, message: 'Корзина пуста' });
  }

  const products = readData('products.json') || [];
  const categories = readData('categories.json') || [];
  const sub = Number(subtotal) || 0;

  const result = checkPromoCode(code, items, sub, products, categories);

  if (!result.ok) {
    return res.status(400).json(result);
  }

  res.json(result);
});

app.post('/api/orders', (req, res) => {
  const { items, subtotal, serviceFee, deliveryFee, promoCode, promoDiscount, deliveryPartnerId, total, guests, hours, eventType, noAlcohol, budget, shopId } = req.body;

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Корзина пуста' });
  }

  if (!shopId) {
    return res.status(400).json({ error: 'Магазин не выбран' });
  }

  const products = readData('products.json') || [];
  const stocks = readData('stocks.json') || [];
  const errors = [];

  items.forEach(item => {
    const product = products.find(p => Number(p.id) === Number(item.id));
    if (!product) {
      errors.push('Товар не найден: ' + item.name);
      return;
    }
    const available = getStockValue(stocks, shopId, product.id);
    const requested = Number(item.qty) || 0;
    if (requested > available) {
      errors.push('Недостаточно «' + product.name + '»: в наличии ' + available + ' ' + (product.unit || ''));
    }
  });

  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  let finalPromoDiscount = 0;
  let finalPromoCode = '';
  let finalPromoId = null;

  if (promoCode && promoCode.trim()) {
    const categories = readData('categories.json') || [];
    const result = checkPromoCode(promoCode, items, Number(subtotal) || 0, products, categories);
    if (!result.ok) {
      return res.status(400).json({ error: result.message });
    }
    finalPromoDiscount = result.discount;
    finalPromoCode = result.code;
    finalPromoId = result.promoId;
  }

  items.forEach(item => {
    const product = products.find(p => Number(p.id) === Number(item.id));
    if (!product) return;
    const requested = Number(item.qty) || 0;
    const current = getStockValue(stocks, shopId, product.id);
    setStockValue(stocks, shopId, product.id, Math.max(0, current - requested));
  });

  writeData('stocks.json', stocks);

  if (finalPromoId) {
    const promos = readData('promo.json') || [];
    const updatedPromos = promos.map(p =>
      Number(p.id) === Number(finalPromoId)
        ? { ...p, usedCount: (Number(p.usedCount) || 0) + 1 }
        : p
    );
    writeData('promo.json', updatedPromos);
  }

  const orders = readData('orders.json') || [];
  const order = {
    id: nextId(orders),
    items: items.map(i => ({
      id: i.id,
      name: i.name,
      price: Number(i.price) || 0,
      qty: Number(i.qty) || 1,
      unit: i.unit || ''
    })),
    subtotal: Number(subtotal) || 0,
    serviceFee: Number(serviceFee) || 0,
    deliveryFee: Number(deliveryFee) || 0,
    promoCode: finalPromoCode,
    promoDiscount: finalPromoDiscount,
    deliveryPartnerId: Number(deliveryPartnerId) || null,
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

/* ---------- АВТОРИЗАЦИЯ ---------- */

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin');
  }
  if (req.session && req.session.isManager) {
    return res.redirect('/admin/my-shop');
  }
  res.render('admin-login', { error: null, login: '' });
});

app.post('/admin/login', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.render('admin-login', {
      error: 'Введите логин и пароль',
      login: login || ''
    });
  }

  const loginTrim = login.trim();

  const ownerLogin = process.env.OWNER_LOGIN;
  const ownerHash = process.env.OWNER_PASSWORD_HASH;

  if (ownerLogin && ownerHash && loginTrim.toLowerCase() === ownerLogin.trim().toLowerCase()) {
    try {
      const ok = await bcrypt.compare(password, ownerHash);
      if (!ok) {
        return res.render('admin-login', {
          error: 'Неверный логин или пароль',
          login: loginTrim
        });
      }
      req.session.isAdmin = true;
      req.session.role = 'owner';
      req.session.userLogin = ownerLogin;
      return res.redirect('/admin');
    } catch (err) {
      console.error('Ошибка проверки пароля владельца:', err.message);
    }
  }

  const managers = readData('managers.json') || [];
  const manager = managers.find(m => String(m.login).toLowerCase() === loginTrim.toLowerCase());

  if (manager) {
    try {
      const ok = await bcrypt.compare(password, manager.passwordHash);
      if (!ok) {
        return res.render('admin-login', {
          error: 'Неверный логин или пароль',
          login: loginTrim
        });
      }
      req.session.isManager = true;
      req.session.role = 'manager';
      req.session.managerId = manager.id;
      req.session.shopId = manager.shopId;
      req.session.userLogin = manager.login;
      return res.redirect('/admin/my-shop');
    } catch (err) {
      console.error('Ошибка проверки пароля менеджера:', err.message);
    }
  }

  return res.render('admin-login', {
    error: 'Неверный логин или пароль',
    login: loginTrim
  });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/admin/login');
  });
});

/* ---------- СТРАНИЦА МЕНЕДЖЕРА ---------- */

app.get('/admin/my-shop', requireManager, (req, res) => {
  const shopId = req.session.shopId;
  const shops = readData('shops.json') || [];
  const cities = readData('cities.json') || [];
  const shop = shops.find(s => Number(s.id) === Number(shopId));

  if (!shop) {
    req.session.destroy(() => res.redirect('/admin/login'));
    return;
  }

  const city = cities.find(c => Number(c.id) === Number(shop.cityId));
  const shopName = (city ? city.name + ', ' : '') + shop.address;

  res.render('admin-my-shop', {
    shop: shop,
    shopName: shopName,
    login: req.session.userLogin || ''
  });
});

app.get('/api/manager/products', requireManager, (req, res) => {
  const shopId = req.session.shopId;
  const products = readData('products.json') || [];
  const stocks = readData('stocks.json') || [];
  const categories = readData('categories.json') || [];

  const productsView = products.map(p => {
    const cat = categories.find(c => Number(c.id) === Number(p.categoryId));
    return {
      id: p.id,
      name: p.name,
      categoryName: cat ? cat.name : '—',
      brand: p.brand || '',
      price: p.price,
      unit: p.unit || 'шт',
      type: p.type || 'piece',
      image: p.image || '',
      badge: p.badge || '',
      badgeLabel: badgeLabel(p.badge, p.discountPercent),
      stock: getStockValue(stocks, shopId, p.id)
    };
  });

  productsView.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  res.json({ products: productsView, shopId: shopId });
});

app.post('/api/manager/stock', requireManager, (req, res) => {
  const shopId = req.session.shopId;
  const { productId, value } = req.body;

  if (!productId) {
    return res.status(400).json({ error: 'Не указан товар' });
  }

  const products = readData('products.json') || [];
  const product = products.find(p => Number(p.id) === Number(productId));
  if (!product) {
    return res.status(404).json({ error: 'Товар не найден' });
  }

  let numValue = Number(value) || 0;
  if (product.type === 'piece') {
    numValue = Math.max(0, Math.round(numValue));
  } else {
    numValue = Math.max(0, numValue);
  }

  const stocks = readData('stocks.json') || [];
  setStockValue(stocks, shopId, productId, numValue);
  writeData('stocks.json', stocks);

  res.json({ ok: true, value: numValue });
});

/* ---------- ВЛАДЕЛЕЦ ---------- */

app.get('/admin', requireOwner, (req, res) => {
  const orders = readData('orders.json') || [];
  res.render('admin-dashboard', {
    cities: (readData('cities.json') || []).length,
    categories: (readData('categories.json') || []).length,
    shops: (readData('shops.json') || []).length,
    products: (readData('products.json') || []).length,
    regions: (readData('regions.json') || []).length,
    partners: (readData('partners.json') || []).length,
    promos: (readData('promo.json') || []).length,
    orders: orders.length
  });
});

/* ---------- РЕГИОНЫ ---------- */

app.get('/admin/regions', requireOwner, (req, res) => {
  res.render('admin-regions', {
    regions: sortByName(readData('regions.json') || []),
    error: req.query.error || null
  });
});

app.post('/admin/regions', requireOwner, (req, res) => {
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

app.post('/admin/regions/:id/edit', requireOwner, (req, res) => {
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

app.post('/admin/regions/:id/delete', requireOwner, (req, res) => {
  const id = Number(req.params.id);
  writeData('regions.json', (readData('regions.json') || []).filter(r => r.id !== id));

  const cities = readData('cities.json') || [];
  const updatedCities = cities.map(c =>
    Number(c.regionId) === id ? { ...c, regionId: null } : c
  );
  writeData('cities.json', updatedCities);

  res.redirect('/admin/regions');
});

/* ---------- ДОСТАВКА ---------- */

app.get('/admin/delivery', requireOwner, (req, res) => {
  res.render('admin-delivery', {
    partners: readData('partners.json') || [],
    error: req.query.error || null
  });
});

app.post('/admin/delivery', requireOwner, (req, res) => {
  const { name, description, url, logo, deliveryFee, serviceFee } = req.body;
  if (!name || !name.trim()) return res.redirect('/admin/delivery');

  const partners = readData('partners.json') || [];
  const normalized = name.trim().toLowerCase();
  const exists = partners.some(p => p.name.toLowerCase() === normalized);

  if (exists) {
    return res.redirect('/admin/delivery?error=' + encodeURIComponent('Партнёр «' + name.trim() + '» уже есть'));
  }

  partners.push({
    id: nextId(partners),
    name: name.trim(),
    description: (description && description.trim()) || '',
    url: (url && url.trim()) || '',
    logo: (logo && logo.trim()) || '',
    deliveryFee: Number(deliveryFee) || 0,
    serviceFee: Number(serviceFee) || 0
  });

  writeData('partners.json', partners);
  res.redirect('/admin/delivery');
});

app.post('/admin/delivery/:id/edit', requireOwner, (req, res) => {
  const id = Number(req.params.id);
  const { name, description, url, logo, deliveryFee, serviceFee } = req.body;
  if (!name || !name.trim()) return res.redirect('/admin/delivery');

  const partners = readData('partners.json') || [];
  const normalized = name.trim().toLowerCase();
  const duplicate = partners.some(p => p.id !== id && p.name.toLowerCase() === normalized);

  if (duplicate) {
    return res.redirect('/admin/delivery?error=' + encodeURIComponent('Партнёр «' + name.trim() + '» уже есть'));
  }

  const updated = partners.map(p =>
    p.id === id
      ? {
          ...p,
          name: name.trim(),
          description: (description && description.trim()) || '',
          url: (url && url.trim()) || '',
          logo: (logo && logo.trim()) || p.logo || '',
          deliveryFee: Number(deliveryFee) || 0,
          serviceFee: Number(serviceFee) || 0
        }
      : p
  );

  writeData('partners.json', updated);
  res.redirect('/admin/delivery');
});

app.post('/admin/delivery/:id/delete', requireOwner, (req, res) => {
  const id = Number(req.params.id);
  writeData('partners.json', (readData('partners.json') || []).filter(p => p.id !== id));
  res.redirect('/admin/delivery');
});

/* ---------- ПРОМОКОДЫ ---------- */

app.get('/admin/promo', requireOwner, (req, res) => {
  const promos = readData('promo.json') || [];
  const categories = sortByName(readData('categories.json') || []);
  const products = readData('products.json') || [];

  const promosView = promos.map(p => ({
    ...p,
    validFromInput: dateToInputValue(p.validFrom),
    validUntilInput: dateToInputValue(p.validUntil)
  }));

  res.render('admin-promo', {
    promos: promosView,
    categories,
    products,
    error: req.query.error || null
  });
});

app.post('/admin/promo', requireOwner, (req, res) => {
  const {
    code, type, value, minSubtotal,
    validFromInput, validUntilInput,
    usageLimit, active,
    categoryIds, productIds, brandNames
  } = req.body;

  if (!code || !code.trim()) {
    return res.redirect('/admin/promo?error=' + encodeURIComponent('Введите код промокода'));
  }

  if (type !== 'percent' && type !== 'fixed') {
    return res.redirect('/admin/promo?error=' + encodeURIComponent('Неверный тип скидки'));
  }

  if (!value || isNaN(Number(value)) || Number(value) <= 0) {
    return res.redirect('/admin/promo?error=' + encodeURIComponent('Введите значение скидки'));
  }

  const promos = readData('promo.json') || [];
  const normalized = code.trim().toLowerCase();
  const exists = promos.some(p => String(p.code).toLowerCase() === normalized);

  if (exists) {
    return res.redirect('/admin/promo?error=' + encodeURIComponent('Промокод «' + code.trim() + '» уже есть'));
  }

  const parseArray = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(x => Number(x) || String(x));
    return [v].map(x => Number(x) || String(x));
  };

  const catIds = parseArray(categoryIds).map(Number).filter(n => !isNaN(n));
  const prodIds = parseArray(productIds).map(Number).filter(n => !isNaN(n));
  const brands = parseArray(brandNames).map(String).filter(s => s && s.trim()).map(s => s.trim());

  promos.push({
    id: nextId(promos),
    code: code.trim(),
    type: type,
    value: Number(value),
    appliesTo: 'products',
    categoryIds: catIds,
    productIds: prodIds,
    brandNames: brands,
    minSubtotal: Number(minSubtotal) || 0,
    validFrom: inputValueToDate(validFromInput),
    validUntil: inputValueToDate(validUntilInput),
    usageLimit: Number(usageLimit) || 0,
    usedCount: 0,
    active: active === 'on' || active === 'true' || active === true,
    createdAt: new Date().toISOString()
  });

  writeData('promo.json', promos);
  res.redirect('/admin/promo');
});

app.post('/admin/promo/:id/edit', requireOwner, (req, res) => {
  const id = Number(req.params.id);
  const {
    code, type, value, minSubtotal,
    validFromInput, validUntilInput,
    usageLimit, active,
    categoryIds, productIds, brandNames
  } = req.body;

  if (!code || !code.trim()) {
    return res.redirect('/admin/promo?error=' + encodeURIComponent('Введите код промокода'));
  }

  if (type !== 'percent' && type !== 'fixed') {
    return res.redirect('/admin/promo?error=' + encodeURIComponent('Неверный тип скидки'));
  }

  if (!value || isNaN(Number(value)) || Number(value) <= 0) {
    return res.redirect('/admin/promo?error=' + encodeURIComponent('Введите значение скидки'));
  }

  const promos = readData('promo.json') || [];
  const normalized = code.trim().toLowerCase();
  const duplicate = promos.some(p => p.id !== id && String(p.code).toLowerCase() === normalized);

  if (duplicate) {
    return res.redirect('/admin/promo?error=' + encodeURIComponent('Промокод «' + code.trim() + '» уже есть'));
  }

  const parseArray = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(x => Number(x) || String(x));
    return [v].map(x => Number(x) || String(x));
  };

  const catIds = parseArray(categoryIds).map(Number).filter(n => !isNaN(n));
  const prodIds = parseArray(productIds).map(Number).filter(n => !isNaN(n));
  const brands = parseArray(brandNames).map(String).filter(s => s && s.trim()).map(s => s.trim());

  const updated = promos.map(p =>
    p.id === id
      ? {
          ...p,
          code: code.trim(),
          type: type,
          value: Number(value),
          appliesTo: 'products',
          categoryIds: catIds,
          productIds: prodIds,
          brandNames: brands,
          minSubtotal: Number(minSubtotal) || 0,
          validFrom: inputValueToDate(validFromInput),
          validUntil: inputValueToDate(validUntilInput),
          usageLimit: Number(usageLimit) || 0,
          active: active === 'on' || active === 'true' || active === true
        }
      : p
  );

  writeData('promo.json', updated);
  res.redirect('/admin/promo');
});

app.post('/admin/promo/:id/delete', requireOwner, (req, res) => {
  const id = Number(req.params.id);
  writeData('promo.json', (readData('promo.json') || []).filter(p => p.id !== id));
  res.redirect('/admin/promo');
});

app.post('/admin/promo/:id/toggle', requireOwner, (req, res) => {
  const id = Number(req.params.id);
  const promos = readData('promo.json') || [];
  const updated = promos.map(p =>
    p.id === id ? { ...p, active: !p.active } : p
  );
  writeData('promo.json', updated);
  res.redirect('/admin/promo');
});

/* ---------- ГОРОДА ---------- */

app.get('/admin/cities', requireOwner, (req, res) => {
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

app.post('/admin/cities', requireOwner, (req, res) => {
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

app.post('/admin/cities/:id/edit', requireOwner, (req, res) => {
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

app.post('/admin/cities/:id/delete', requireOwner, (req, res) => {
  const id = Number(req.params.id);
  writeData('cities.json', (readData('cities.json') || []).filter(c => c.id !== id));

  const shops = readData('shops.json') || [];
  const shopsToDelete = shops.filter(s => Number(s.cityId) === id).map(s => Number(s.id));
  writeData('shops.json', shops.filter(s => Number(s.cityId) !== id));

  const stocks = readData('stocks.json') || [];
  writeData('stocks.json', stocks.filter(s => !shopsToDelete.includes(Number(s.shopId))));

  const managers = readData('managers.json') || [];
  writeData('managers.json', managers.filter(m => !shopsToDelete.includes(Number(m.shopId))));

  res.redirect('/admin/cities');
});

/* ---------- КАТЕГОРИИ ---------- */

app.get('/admin/categories', requireOwner, (req, res) => {
  res.render('admin-categories', {
    categories: sortByName(readData('categories.json') || []),
    error: req.query.error || null
  });
});

app.post('/admin/categories', requireOwner, (req, res) => {
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

app.post('/admin/categories/:id/edit', requireOwner, (req, res) => {
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

app.post('/admin/categories/:id/delete', requireOwner, (req, res) => {
  const id = Number(req.params.id);
  writeData('categories.json', (readData('categories.json') || []).filter(c => c.id !== id));
  res.redirect('/admin/categories');
});

/* ---------- МАГАЗИНЫ ---------- */

app.get('/admin/shops', requireOwner, (req, res) => {
  const shops = readData('shops.json') || [];
  const cities = sortByName(readData('cities.json') || []);
  const managers = readData('managers.json') || [];

  const shopsWithCity = shops.map(s => {
    const city = cities.find(c => Number(c.id) === Number(s.cityId));
    const manager = managers.find(m => Number(m.shopId) === Number(s.id));
    return {
      ...s,
      cityName: city ? city.name : '—',
      managerLogin: manager ? manager.login : '—'
    };
  });

  shopsWithCity.sort((a, b) => {
    const byCity = a.cityName.localeCompare(b.cityName, 'ru');
    if (byCity !== 0) return byCity;
    return a.address.localeCompare(b.address, 'ru');
  });

  res.render('admin-shops', {
    cities,
    shops: shopsWithCity,
    error: req.query.error || null,
    newPassword: req.query.newPassword || null,
    newLogin: req.query.newLogin || null,
    shopId: req.query.shopId || null
  });
});

app.post('/admin/shops', requireOwner, async (req, res) => {
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

  const shopId = nextId(shops);

  shops.push({
    id: shopId,
    cityId: Number(cityId),
    address: address.trim(),
    metro: (metro && metro.trim()) || '',
    hours: `${hoursFrom}–${hoursTo}`
  });

  writeData('shops.json', shops);

  const plainPassword = generatePassword(12);
  const passwordHash = await bcrypt.hash(plainPassword, 12);
  const managerLogin = 'shop-' + shopId + '@kb.ru';

  const managers = readData('managers.json') || [];
  managers.push({
    id: nextId(managers),
    login: managerLogin,
    passwordHash: passwordHash,
    shopId: shopId,
    createdAt: new Date().toISOString()
  });
  writeData('managers.json', managers);

  res.redirect('/admin/shops?newLogin=' + encodeURIComponent(managerLogin) + '&newPassword=' + encodeURIComponent(plainPassword) + '&shopId=' + shopId);
});

app.post('/admin/shops/:id/edit', requireOwner, (req, res) => {
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

app.post('/admin/shops/:id/delete', requireOwner, (req, res) => {
  const id = Number(req.params.id);
  writeData('shops.json', (readData('shops.json') || []).filter(s => s.id !== id));
  writeData('managers.json', (readData('managers.json') || []).filter(m => Number(m.shopId) !== id));
  writeData('stocks.json', (readData('stocks.json') || []).filter(s => Number(s.shopId) !== id));
  res.redirect('/admin/shops');
});

app.post('/admin/shops/:id/reset-password', requireOwner, async (req, res) => {
  const id = Number(req.params.id);

  const shops = readData('shops.json') || [];
  const shop = shops.find(s => Number(s.id) === id);
  if (!shop) return res.redirect('/admin/shops');

  const managers = readData('managers.json') || [];
  let manager = managers.find(m => Number(m.shopId) === id);

  const plainPassword = generatePassword(12);
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  if (manager) {
    manager.passwordHash = passwordHash;
  } else {
    manager = {
      id: nextId(managers),
      login: 'shop-' + id + '@kb.ru',
      passwordHash: passwordHash,
      shopId: id,
      createdAt: new Date().toISOString()
    };
    managers.push(manager);
  }

  writeData('managers.json', managers);

  res.redirect('/admin/shops?newLogin=' + encodeURIComponent(manager.login) + '&newPassword=' + encodeURIComponent(plainPassword) + '&shopId=' + id);
});

/* ---------- ЗАГРУЗКА ИЗОБРАЖЕНИЙ ---------- */

app.post('/admin/upload/image', requireOwner, uploadProduct.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  const url = '/uploads/products/' + req.file.filename;
  res.json({ ok: true, url: url });
});

app.post('/admin/upload/partner', requireOwner, uploadPartner.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  const url = '/uploads/partners/' + req.file.filename;
  res.json({ ok: true, url: url });
});

/* ---------- ТОВАРЫ ---------- */

app.get('/admin/products', requireOwner, (req, res) => {
  const products = readData('products.json') || [];
  const categories = sortByName(readData('categories.json') || []);

  const productsWithCat = products.map(p => {
    const cat = categories.find(c => Number(c.id) === Number(p.categoryId));
    return {
      ...p,
      categoryName: cat ? cat.name : '—',
      badgeLabel: badgeLabel(p.badge, p.discountPercent)
    };
  });

  productsWithCat.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  res.render('admin-products', {
    categories,
    products: productsWithCat,
    badgeOptions: [
      { value: '', label: 'Без бейджа' },
      { value: 'hit', label: 'Хит' },
      { value: 'discount', label: 'Скидка %' },
      { value: 'new', label: 'Новинка' },
      { value: 'sale', label: 'SALE' },
      { value: '1+1', label: '1+1' }
    ],
    error: req.query.error || null
  });
});

app.post('/admin/products', requireOwner, (req, res) => {
  const {
    name, categoryId, brand, price, type, weight,
    badge, discountPercent, image
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

  const basePrice = Number(price);
  const badgeCode = badge || '';
  let finalPrice = basePrice;
  let oldPrice = null;
  let discount = 0;

  if (badgeCode === 'discount') {
    discount = Math.min(99, Math.max(0, Number(discountPercent) || 0));
    if (discount > 0) {
      oldPrice = basePrice;
      finalPrice = Math.round(basePrice * (1 - discount / 100) * 100) / 100;
    }
  }

  products.push({
    id: nextId(products),
    name: name.trim(),
    categoryId: Number(categoryId),
    brand: (brand && brand.trim()) || '',
    price: finalPrice,
    oldPrice: oldPrice,
    discountPercent: discount,
    type: type,
    unit: type === 'weight' ? 'кг' : 'шт',
    weight: (weight && weight.trim()) || '',
    badge: badgeCode,
    image: (image && image.trim()) || ''
  });

  writeData('products.json', products);
  res.redirect('/admin/products');
});

app.post('/admin/products/:id/edit', requireOwner, (req, res) => {
  const id = Number(req.params.id);
  const {
    name, categoryId, brand, price, type, weight,
    badge, discountPercent, image
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

  const basePrice = Number(price);
  const badgeCode = badge || '';
  let finalPrice = basePrice;
  let oldPrice = null;
  let discount = 0;

  if (badgeCode === 'discount') {
    discount = Math.min(99, Math.max(0, Number(discountPercent) || 0));
    if (discount > 0) {
      oldPrice = basePrice;
      finalPrice = Math.round(basePrice * (1 - discount / 100) * 100) / 100;
    }
  }

  const updated = products.map(p =>
    p.id === id
      ? {
          ...p,
          name: name.trim(),
          categoryId: Number(categoryId),
          brand: (brand && brand.trim()) || '',
          price: finalPrice,
          oldPrice: oldPrice,
          discountPercent: discount,
          type: type,
          unit: type === 'weight' ? 'кг' : 'шт',
          weight: (weight && weight.trim()) || '',
          badge: badgeCode,
          image: (image && image.trim()) || p.image || ''
        }
      : p
  );

  writeData('products.json', updated);
  res.redirect('/admin/products');
});

app.post('/admin/products/:id/delete', requireOwner, (req, res) => {
  const id = Number(req.params.id);
  writeData('products.json', (readData('products.json') || []).filter(p => p.id !== id));
  writeData('stocks.json', (readData('stocks.json') || []).filter(s => Number(s.productId) !== id));
  res.redirect('/admin/products');
});

/* ---------- НАСТРОЙКИ КАЛЬКУЛЯТОРА ---------- */

app.get('/admin/calc-settings', requireOwner, (req, res) => {
  const settings = readData('settings.json') || { calc: {} };
  res.render('admin-calc-settings', {
    calc: settings.calc || {},
    error: req.query.error || null
  });
});

app.post('/admin/calc-settings', requireOwner, (req, res) => {
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

app.get('/admin/orders', requireOwner, (req, res) => {
  const orders = readData('orders.json') || [];
  const shops = readData('shops.json') || [];
  const cities = readData('cities.json') || [];

  const ordersView = orders.map(o => {
    let shopName = '—';
    if (o.shopId) {
      const shop = shops.find(s => Number(s.id) === Number(o.shopId));
      if (shop) {
        const city = cities.find(c => Number(c.id) === Number(shop.cityId));
        shopName = (city ? city.name + ', ' : '') + shop.address;
      }
    }
    return { ...o, shopName: shopName };
  });

  ordersView.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.render('admin-orders', { orders: ordersView });
});

app.post('/admin/orders/:id/delete', requireOwner, (req, res) => {
  const id = Number(req.params.id);
  writeData('orders.json', (readData('orders.json') || []).filter(o => o.id !== id));
  res.redirect('/admin/orders');
});

/* ---------- ПРОВЕРКА ПРОМОКОДА ---------- */

function checkPromoCode(code, items, subtotal, products, categories) {
  if (!code || !code.trim()) {
    return { ok: false, message: 'Введите промокод' };
  }

  const promoList = readData('promo.json') || [];
  const promo = promoList.find(p => String(p.code).toUpperCase() === String(code).trim().toUpperCase());

  if (!promo) {
    return { ok: false, message: 'Промокод не найден' };
  }

  if (!promo.active) {
    return { ok: false, message: 'Промокод недействителен' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (promo.validFrom) {
    const fromDate = parseDateDDMMYYYY(promo.validFrom);
    if (fromDate && today < fromDate) {
      return { ok: false, message: 'Промокод ещё не действует' };
    }
  }

  if (promo.validUntil) {
    const untilDate = parseDateDDMMYYYY(promo.validUntil);
    if (untilDate) {
      untilDate.setHours(23, 59, 59, 999);
      if (today > untilDate) {
        return { ok: false, message: 'Срок действия промокода истёк' };
      }
    }
  }

  if (Number(promo.usageLimit) > 0 && Number(promo.usedCount) >= Number(promo.usageLimit)) {
    return { ok: false, message: 'Промокод недействителен' };
  }

  const minSubtotal = Number(promo.minSubtotal) || 0;
  if (minSubtotal > 0 && subtotal < minSubtotal) {
    return { ok: false, message: 'Минимальная сумма ' + minSubtotal + ' ₽' };
  }

  const catIds = Array.isArray(promo.categoryIds) ? promo.categoryIds.map(Number) : [];
  const prodIds = Array.isArray(promo.productIds) ? promo.productIds.map(Number) : [];
  const brandNames = Array.isArray(promo.brandNames) ? promo.brandNames.map(s => String(s).toLowerCase()) : [];

  const applicableItems = [];

  items.forEach(item => {
    const product = products.find(p => Number(p.id) === Number(item.id));
    if (!product) return;

    if (catIds.length > 0 && !catIds.includes(Number(product.categoryId))) return;
    if (prodIds.length > 0 && !prodIds.includes(Number(product.id))) return;
    if (brandNames.length > 0 && !brandNames.includes(String(product.brand || '').toLowerCase())) return;

    applicableItems.push({
      id: product.id,
      name: product.name,
      qty: Number(item.qty) || 0,
      price: Number(item.price) || 0,
      sum: (Number(item.qty) || 0) * (Number(item.price) || 0)
    });
  });

  if (!applicableItems.length) {
    return { ok: false, message: 'Промокод не подходит ни к одному товару' };
  }

  const applicableSum = applicableItems.reduce((s, i) => s + i.sum, 0);

  let discount = 0;
  const value = Number(promo.value) || 0;

  if (promo.type === 'fixed') {
    discount = Math.min(value, applicableSum);
  } else {
    discount = Math.round(applicableSum * value) / 100;
  }

  discount = Math.round(discount * 100) / 100;

  return {
    ok: true,
    promoId: promo.id,
    code: promo.code,
    type: promo.type,
    value: value,
    discount: discount,
    applicableItems: applicableItems,
    message: 'Промокод применён'
  };
}

/* ---------- API АДМИНКИ ---------- */

app.get('/api/admin/cities', requireAuthApi, (req, res) => res.json(sortByName(readData('cities.json') || [])));
app.get('/api/admin/categories', requireAuthApi, (req, res) => res.json(sortByName(readData('categories.json') || [])));
app.get('/api/admin/shops', requireAuthApi, (req, res) => res.json(readData('shops.json') || []));
app.get('/api/admin/products', requireAuthApi, (req, res) => res.json(readData('products.json') || []));
app.get('/api/admin/regions', requireAuthApi, (req, res) => res.json(readData('regions.json') || []));
app.get('/api/admin/partners', requireAuthApi, (req, res) => res.json(readData('partners.json') || []));
app.get('/api/admin/promo', requireAuthApi, (req, res) => res.json(readData('promo.json') || []));
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
    console.log('  Вход владельца невозможен.');
    console.log('');
  }
  if (!process.env.SESSION_SECRET) {
    console.log('  ВНИМАНИЕ: SESSION_SECRET не задан в .env');
    console.log('');
  }
});