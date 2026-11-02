// Posts API: anyone can read the works; only signed-in Axel can add, edit or delete.
const express = require('express');
const db = require('./db');
const { requireLogin } = require('./auth');

const router = express.Router();

// "My New Work!" -> "my-new-work"
function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // å -> a, é -> e
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const str = (value, max = 10000) => String(value ?? '').trim().slice(0, max);
const isUrl = (value) => value === '' || /^https:\/\//.test(value);

// Never trust what the browser sends: keep only the fields and shapes we expect
function cleanPost(body) {
  const title = str(body.title, 200);
  if (!title) return { error: 'The work needs a title.' };

  const slug = slugify(body.slug || title);
  if (!slug) return { error: 'The slug can only use letters, numbers and dashes.' };

  const videoUrl = str(body.video_url, 1000);
  if (!isUrl(videoUrl)) return { error: 'The video link must start with https://' };

  const process = (Array.isArray(body.process) ? body.process : [])
    .map((block) => block.type === 'list'
      ? { type: 'list', items: (Array.isArray(block.items) ? block.items : []).map((i) => str(i, 500)).filter(Boolean) }
      : { type: 'text', text: str(block.text) })
    .filter((block) => (block.type === 'list' ? block.items.length : block.text));

  const images = (Array.isArray(body.reference_images) ? body.reference_images : [])
    .map((img) => ({ url: str(img.url, 1000), alt: str(img.alt, 300) }))
    .filter((img) => img.url && isUrl(img.url));

  const tags = (Array.isArray(body.tags) ? body.tags : []).map((t) => str(t, 60)).filter(Boolean);

  const year = Number.parseInt(body.year, 10);
  const position = Number.parseInt(body.position, 10);

  return {
    post: {
      slug,
      title,
      year: Number.isFinite(year) ? year : null,
      position: Number.isFinite(position) ? position : 0,
      video_url: videoUrl,
      process: JSON.stringify(process),
      reference_images: JSON.stringify(images),
      tags,
      summary: str(body.summary, 5000),
    },
  };
}

// Postgres error 23505 = a UNIQUE rule was broken (here: the slug is taken)
function handleDbError(err, res, next) {
  if (err.code === '23505') return res.status(409).json({ error: 'Another work already uses this slug.' });
  next(err);
}

const COLUMNS = 'id, slug, title, year, position, video_url, process, reference_images, tags, summary';

// All posts in Axel's chosen order. This is what builds the cube.
router.get('/api/posts', async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT ${COLUMNS} FROM posts ORDER BY position, created_at`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/api/posts', requireLogin, async (req, res, next) => {
  const { post, error } = cleanPost(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await db.query(
      `INSERT INTO posts (slug, title, year, position, video_url, process, reference_images, tags, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${COLUMNS}`,
      [post.slug, post.title, post.year, post.position, post.video_url,
       post.process, post.reference_images, post.tags, post.summary]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    handleDbError(err, res, next);
  }
});

router.put('/api/posts/:id', requireLogin, async (req, res, next) => {
  const { post, error } = cleanPost(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await db.query(
      `UPDATE posts SET slug = $1, title = $2, year = $3, position = $4, video_url = $5,
         process = $6, reference_images = $7, tags = $8, summary = $9, updated_at = now()
       WHERE id = $10
       RETURNING ${COLUMNS}`,
      [post.slug, post.title, post.year, post.position, post.video_url,
       post.process, post.reference_images, post.tags, post.summary, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'That work no longer exists.' });
    res.json(rows[0]);
  } catch (err) {
    handleDbError(err, res, next);
  }
});

router.delete('/api/posts/:id', requireLogin, async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'That work no longer exists.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
