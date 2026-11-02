// Comments API: anyone can read and write comments on a work.
// Emails and last names are saved for Axel but never sent to visitors;
// a comment is shown with the first name only.
const express = require('express');
const db = require('./db');

const router = express.Router();

const PUBLIC_COLUMNS = 'id, first_name, body, created_at';
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

router.get('/api/posts/:id/comments', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT ${PUBLIC_COLUMNS} FROM comments WHERE post_id = $1 ORDER BY created_at`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/api/posts/:id/comments', async (req, res, next) => {
  const clean = (value, max) => String(req.body[value] ?? '').trim().slice(0, max);
  const firstName = clean('first_name', 80);
  const lastName = clean('last_name', 80);
  const email = clean('email', 200);
  const body = clean('body', 2000);

  // The form checks these too, but the server must check again: anyone can send requests directly
  if (!firstName || !lastName || !email || !body) {
    return res.status(400).json({ error: 'Please fill in first name, last name, email and comment.' });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO comments (post_id, first_name, last_name, email, body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${PUBLIC_COLUMNS}`,
      [req.params.id, firstName, lastName, email, body]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    // 23503 = the post doesn't exist (foreign key), 22P02 = the id isn't a number
    if (err.code === '23503' || err.code === '22P02') {
      return res.status(404).json({ error: 'That work no longer exists.' });
    }
    next(err);
  }
});

module.exports = router;
