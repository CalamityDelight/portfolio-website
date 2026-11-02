// Express server: serves the front end in /public and a small JSON API.
require('dotenv').config({ quiet: true }); // reads secrets from .env into process.env
const express = require('express');
const session = require('express-session');
const path = require('path');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is missing. Add it to .env (see .env.example).');
}

app.use(express.json());

// Sessions: after login the browser gets a cookie holding only a random,
// signed session id. The server remembers which id belongs to a signed-in user.
app.use(session({
  secret: process.env.SESSION_SECRET,   // signs the cookie so it can't be forged
  resave: false,
  saveUninitialized: false,             // no cookie at all for visitors who don't sign in
  cookie: {
    httpOnly: true,                     // page scripts can't read the cookie
    sameSite: 'lax',                    // not sent with requests from other sites
    secure: process.env.NODE_ENV === 'production', // HTTPS only once the site is live
    maxAge: 1000 * 60 * 60 * 8,         // signed out automatically after 8 hours
  },
}));

// extensions: ['html'] lets /login serve login.html
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ---------- Routes ----------
app.use(auth.router);           // login, logout, "am I signed in?"
app.use(require('./posts'));    // read, add, edit, delete works
app.use(require('./uploads'));  // signs uploads to Cloudinary
app.use(require('./comments')); // read and post comments
app.use(require('./kp'));       // Earth's magnetic field (NOAA Kp)

// The studio page itself is only sent to a signed-in user; everyone else goes to /login
app.get('/studio', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'views', 'studio.html'));
});

// ---------- Errors ----------

// Any route that fails ends up here: log the details, send a plain message
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
});
