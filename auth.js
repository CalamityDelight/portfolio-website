// Login, sign-out and the guard that protects the studio.
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('./db');

const router = express.Router();

// Middleware: lets the request through only if someone is signed in
function requireLogin(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'Please sign in first.' });
}

router.post('/api/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Enter your username and password.' });
    }

    const { rows } = await db.query('SELECT id, password_hash FROM users WHERE username = $1', [username]);
    const user = rows[0];

    // bcrypt.compare hashes the typed password the same way and compares the results.
    // The same message for "no such user" and "wrong password" gives nothing away.
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Wrong username or password.' });
    }

    // A fresh session id on login, so an id someone saw before login is worthless
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      res.json({ ok: true });
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// Lets the front end ask "am I signed in?" to show the right footer links
router.get('/api/me', (req, res) => {
  res.json({ signedIn: Boolean(req.session.userId) });
});

module.exports = { router, requireLogin };
