// One shared connection pool to Neon Postgres.
// The server runs for a long time, so reusing a few open connections is
// faster than opening a new one for every request. DATABASE_URL is Neon's
// pooled address (the host ends in -pooler), meant for app traffic.
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Add it to .env (see .env.example).');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = pool;
