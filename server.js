// Express server: serves the front end in /public and a small JSON API.
require('dotenv').config({ quiet: true }); // reads secrets from .env into process.env
const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Posts ----------

// All posts in Axel's chosen order. This is what builds the cube.
app.get('/api/posts', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, slug, title, year, position, video_url, process, reference_images, tags, summary
       FROM posts ORDER BY position, created_at`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
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
