import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
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
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`Ошибка чтения ${file}:`, err.message);
    return [];
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

app.get('/api/data', (req, res) => {
  res.json({
    cities: readData('cities.json'),
    categories: readData('categories.json'),
    shops: readData('shops.json')
  });
});

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin');
  }
  res.render('admin-login', { error: null });
});

app.post('/admin/login', async (req, res) => {
  const { password } = req.body;
  const hash = process.env.ADMIN_PASSWORD_HASH;

  if (!hash) {
    return res.render('admin-login', { error: 'Пароль не настроен на сервере' });
  }

  if (!password || typeof password !== 'string') {
    return res.render('admin-login', { error: 'Введите пароль' });
  }

  try {
    const ok = await bcrypt.compare(password, hash);
    if (!ok) {
      return res.render('admin-login', { error: 'Неверный пароль' });
    }
    req.session.isAdmin = true;
    return res.redirect('/admin');
  } catch (err) {
    console.error('Ошибка проверки пароля:', err.message);
    return res.render('admin-login', { error: 'Ошибка сервера' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/admin/login');
  });
});

app.get('/admin', requireAuth, (req, res) => {
  const cities = readData('cities.json');
  const categories = readData('categories.json');
  const shops = readData('shops.json');
  res.render('admin-dashboard', {
    cities: cities.length,
    categories: categories.length,
    shops: shops.length
  });
});

app.get('/admin/cities', requireAuth, (req, res) => {
  res.render('admin-cities', { cities: readData('cities.json') });
});

app.post('/admin/cities', requireAuth, (req, res) => {
  const { name, shopsCount } = req.body;
  if (!name || !name.trim()) {
    return res.redirect('/admin/cities');
  }

  const cities = readData('cities.json');
  const exists = cities.some(c => c.name.toLowerCase() === name.trim().toLowerCase());
  if (exists) {
    return res.redirect('/admin/cities');
  }

  cities.push({
    id: Date.now(),
    name: name.trim(),
    shops: Number(shopsCount) || 0,
    stores: []
  });

  writeData('cities.json', cities);
  res.redirect('/admin/cities');
});

app.post('/admin/cities/:id/delete', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const cities = readData('cities.json').filter(c => c.id !== id);
  writeData('cities.json', cities);

  const shops = readData('shops.json').filter(s => Number(s.cityId) !== id);
  writeData('shops.json', shops);

  res.redirect('/admin/cities');
});

app.get('/admin/categories', requireAuth, (req, res) => {
  res.render('admin-categories', { categories: readData('categories.json') });
});

app.post('/admin/categories', requireAuth, (req, res) => {
  const { name, slug, count } = req.body;
  if (!name || !name.trim()) {
    return res.redirect('/admin/categories');
  }

  const categories = readData('categories.json');
  const generatedSlug = (slug && slug.trim())
    ? slug.trim().toLowerCase()
    : name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  categories.push({
    id: Date.now(),
    name: name.trim(),
    slug: generatedSlug,
    count: Number(count) || 0
  });

  writeData('categories.json', categories);
  res.redirect('/admin/categories');
});

app.post('/admin/categories/:id/delete', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const categories = readData('categories.json').filter(c => c.id !== id);
  writeData('categories.json', categories);
  res.redirect('/admin/categories');
});

app.get('/admin/shops', requireAuth, (req, res) => {
  const cities = readData('cities.json');
  const shops = readData('shops.json');
  res.render('admin-shops', { cities, shops });
});

app.post('/admin/shops', requireAuth, (req, res) => {
  const { cityId, address, hours, metro } = req.body;

  if (!cityId || !address || !address.trim()) {
    return res.redirect('/admin/shops');
  }

  const shops = readData('shops.json');
  shops.push({
    id: Date.now(),
    cityId: Number(cityId),
    address: address.trim(),
    hours: (hours && hours.trim()) || '08:00–23:00',
    metro: (metro && metro.trim()) || ''
  });

  writeData('shops.json', shops);
  res.redirect('/admin/shops');
});

app.post('/admin/shops/:id/delete', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const shops = readData('shops.json').filter(s => s.id !== id);
  writeData('shops.json', shops);
  res.redirect('/admin/shops');
});

app.get('/api/admin/cities', requireAuthApi, (req, res) => {
  res.json(readData('cities.json'));
});

app.post('/api/admin/cities', requireAuthApi, (req, res) => {
  const { name, shopsCount } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Название обязательно' });
  }

  const cities = readData('cities.json');
  const city = {
    id: Date.now(),
    name: name.trim(),
    shops: Number(shopsCount) || 0,
    stores: []
  };
  cities.push(city);
  writeData('cities.json', cities);
  res.json(city);
});

app.delete('/api/admin/cities/:id', requireAuthApi, (req, res) => {
  const id = Number(req.params.id);
  const cities = readData('cities.json').filter(c => c.id !== id);
  writeData('cities.json', cities);

  const shops = readData('shops.json').filter(s => Number(s.cityId) !== id);
  writeData('shops.json', shops);

  res.json({ ok: true });
});

app.get('/api/admin/categories', requireAuthApi, (req, res) => {
  res.json(readData('categories.json'));
});

app.post('/api/admin/categories', requireAuthApi, (req, res) => {
  const { name, slug, count } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Название обязательно' });
  }

  const categories = readData('categories.json');
  const category = {
    id: Date.now(),
    name: name.trim(),
    slug: (slug && slug.trim()) || name.trim().toLowerCase().replace(/\s+/g, '-'),
    count: Number(count) || 0
  };
  categories.push(category);
  writeData('categories.json', categories);
  res.json(category);
});

app.delete('/api/admin/categories/:id', requireAuthApi, (req, res) => {
  const id = Number(req.params.id);
  const categories = readData('categories.json').filter(c => c.id !== id);
  writeData('categories.json', categories);
  res.json({ ok: true });
});

app.get('/api/admin/shops', requireAuthApi, (req, res) => {
  res.json(readData('shops.json'));
});

app.post('/api/admin/shops', requireAuthApi, (req, res) => {
  const { cityId, address, hours, metro } = req.body;
  if (!cityId || !address || !address.trim()) {
    return res.status(400).json({ error: 'Город и адрес обязательны' });
  }

  const shops = readData('shops.json');
  const shop = {
    id: Date.now(),
    cityId: Number(cityId),
    address: address.trim(),
    hours: (hours && hours.trim()) || '08:00–23:00',
    metro: (metro && metro.trim()) || ''
  };
  shops.push(shop);
  writeData('shops.json', shops);
  res.json(shop);
});

app.delete('/api/admin/shops/:id', requireAuthApi, (req, res) => {
  const id = Number(req.params.id);
  const shops = readData('shops.json').filter(s => s.id !== id);
  writeData('shops.json', shops);
  res.json({ ok: true });
});

app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>404 — Страница не найдена</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #FAFAFA; color: #1A1A1A; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .box { text-align: center; }
        h1 { font-size: 72px; color: #A52A2A; margin: 0; }
        p { color: #6B6B6B; margin: 12px 0 24px; }
        a { color: #A52A2A; font-weight: 600; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>404</h1>
        <p>Страница не найдена</p>
        <a href="/">Вернуться на главную</a>
      </div>
    </body>
    </html>
  `);
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
  if (!process.env.ADMIN_PASSWORD_HASH) {
    console.log('  ВНИМАНИЕ: ADMIN_PASSWORD_HASH не задан в .env');
    console.log('  Вход в админку невозможен, пока не настроишь пароль.');
    console.log('');
  }
  if (!process.env.SESSION_SECRET) {
    console.log('  ВНИМАНИЕ: SESSION_SECRET не задан в .env');
    console.log('  Используется небезопасный дефолт.');
    console.log('');
  }
});