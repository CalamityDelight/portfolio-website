// Creates the tables and, if there are no posts yet, adds the placeholder works.
// Run with: npm run db:setup
//
// Uses Neon's direct (unpooled) address when available: Neon recommends it for
// schema changes, while the app itself uses the pooled one.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  });
  await client.connect();

  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await client.query(schema);
  console.log('Tables ready: users, posts, comments');

  const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM posts');
  if (rows[0].count > 0) {
    console.log(`Posts already exist (${rows[0].count}), skipping the placeholder works.`);
  } else {
    const works = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db', 'seed-works.json'), 'utf8'));
    for (const w of works) {
      // $1, $2 … are placeholders: pg sends the values separately, so text in
      // them can never be run as SQL (this prevents SQL injection)
      await client.query(
        `INSERT INTO posts (slug, title, year, position, video_url, process, reference_images, tags, summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [w.slug, w.title, w.year, w.position, w.video_url,
         JSON.stringify(w.process), JSON.stringify(w.reference_images), w.tags, w.summary]
      );
    }
    console.log(`Added ${works.length} placeholder works.`);
  }

  await client.end();
}

main().catch((err) => {
  console.error('Database setup failed:', err.message);
  process.exit(1);
});
