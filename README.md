# Axel af Ugglas — Portfolio

A cinematic portfolio of Axel af Ugglas's AI video work and CV, explored like an unfolding cube.
Built for the Berghs individual blog project (Programming & Methods, ACE2627).

> Work in progress. The full README (what was built, what was left out, service setup) comes in Part 3.

## Run it locally

1. Install the packages:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the values (see below).
3. Create the tables and add the placeholder works:
   ```bash
   npm run db:setup
   ```
4. Start the server and open http://localhost:3000:
   ```bash
   npm start
   ```

### Database (Neon)

1. Create a free project at https://neon.tech.
2. Put its connection strings in `.env` as `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).
   With the Neon CLI, `npx neon@latest env pull` does this for you.

## How to move around

- **Arrow keys** or the on-screen arrows: left/right switch between Home and the works, up/down go through a column.
- **Swipe** on a phone does the same.
- **Space, Enter** or the **Overview** button opens the zoom-out map of every work.

## Data

Posts and comments live in Neon Postgres. The tables are defined in `db/schema.sql`.
`db/seed-works.json` holds the placeholder works that `npm run db:setup` adds to an empty database.

## Stack

- Node.js + Express
- PostgreSQL on Neon, through the `pg` driver
- Plain HTML, CSS and JavaScript (no framework, no build step)

## Structure

```
server.js            Express server and API routes
db.js                Shared connection pool to Neon
db/                  schema.sql and the placeholder works
scripts/setup-db.js  Creates the tables and seeds the placeholder works
neon.ts              Neon project config (used by the Neon CLI)
public/index.html    Page shell and the Home column
public/css/          base (design system), home, work, cube, menu
public/js/           app (entry), works, player, cube, menu, fibres
```
