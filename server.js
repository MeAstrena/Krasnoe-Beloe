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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000
  }
}));

function readData(file) {
  const filePath = path.join(__dirname, 'data', file);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeData(file, data) {
  const filePath = path.join(__dirname, 'data', file);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function requireAuth(req, res, next) {
  if (req.session.isAdmin) return next();
  res.redirect('/admin/login');
}

app.get('/admin/login', (req, res) => {
  res.render('admin-login', { error: null });
});

app.post('/admin/login', async (req, res) => {
  const { password } = req.body;
  const hash = process.env.ADMIN_PASSWORD_HASH;

  if (!hash) {
    return res.render('admin-login', { error: 'Пароль не настроен на сервере' });
  }

  const ok = await bcrypt.compare(password, hash);

  if (!ok) {
    return res.render('admin-login', { error: 'Неверный пароль' });
  }

  req.session.isAdmin = true;
  res.redirect('/admin');
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
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
  const cities = readData('cities.json');
  const { name, shopsCount } = req.body;
  cities.push({
    id: Date.now(),
    name,
    shops: Number(shopsCount) || 0,
    stores: []
  });
  writeData('cities.json', cities);
  res.redirect('/admin/cities');
});

app.post('/admin/cities/:id/delete', requireAuth, (req, res) => {
  const cities = readData('cities.json').filter(c => c.id !== Number(req.params.id));
  writeData('cities.json', cities);
  res.redirect('/admin/cities');
});

app.get('/admin/categories', requireAuth, (req, res) => {
  res.render('admin-categories', { categories: readData('categories.json') });
});

app.post('/admin/categories', requireAuth, (req, res) => {
  const categories = readData('categories.json');
  const { name, slug, count } = req.body;
  categories.push({
    id: Date.now(),
    name,
    slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
    count: Number(count) || 0
  });
  writeData('categories.json', categories);
  res.redirect('/admin/categories');
});

app.post('/admin/categories/:id/delete', requireAuth, (req, res) => {
  const categories = readData('categories.json').filter(c => c.id !== Number(req.params.id));
  writeData('categories.json', categories);
  res.redirect('/admin/categories');
});

app.get('/admin/shops', requireAuth, (req, res) => {
  const cities = readData('cities.json');
  const shops = readData('shops.json');
  res.render('admin-shops', { cities, shops });
});

app.post('/admin/shops', requireAuth, (req, res) => {
  const shops = readData('shops.json');
  const { cityId, address, hours, metro } = req.body;
  shops.push({
    id: Date.now(),
    cityId: Number(cityId),
    address,
    hours: hours || '08:00–23:00',
    metro: metro || ''
  });
  writeData('shops.json', shops);
  res.redirect('/admin/shops');
});

app.post('/admin/shops/:id/delete', requireAuth, (req, res) => {
  const shops = readData('shops.json').filter(s => s.id !== Number(req.params.id));
  writeData('shops.json', shops);
  res.redirect('/admin/shops');
});

app.get('/api/data', (req, res) => {
  res.json({
    cities: readData('cities.json'),
    categories: readData('categories.json'),
    shops: readData('shops.json')
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
  console.log(`Админка: http://localhost:${PORT}/admin`);
});