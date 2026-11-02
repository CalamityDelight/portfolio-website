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
4. Create the login for the studio (asks for a username and password):
   ```bash
   npm run create-user
   ```
5. Start the server and open http://localhost:3000:
   ```bash
   npm start
   ```

### Database (Neon)

1. Create a free project at https://neon.tech.
2. Put its connection strings in `.env` as `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).
   With the Neon CLI, `npx neon@latest env pull` does this for you.

### Media uploads (Cloudinary)

1. Create a free account at https://cloudinary.com.
2. In the Cloudinary console, copy the **API environment variable** (`cloudinary://…`).
3. Put it in `.env` as `CLOUDINARY_URL`.

### Session secret

`SESSION_SECRET` signs the login cookie. Use any long random string, for example from:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Studio

Click the small **login** link at the bottom of the site, sign in, and you land in the studio at `/studio`.
There you can add, edit and delete works, upload a video and reference images, write process blocks and pick tags.
Only signed-in users can open the studio or change posts; there is no public sign-up.

## How to move around

- **Arrow keys** or the on-screen arrows: left/right switch between Home and the works, up/down go through a column.
- **Swipe** on a phone does the same.
- **Space, Enter** or the **Overview** button opens the zoom-out map of every work.

## Data

Posts, comments and the login live in Neon Postgres. The tables are defined in `db/schema.sql`.
`db/seed-works.json` holds the placeholder works that `npm run db:setup` adds to an empty database.
Comments require first name, last name and email; only the first name is ever shown.

## Stack

- Node.js + Express
- PostgreSQL on Neon, through the `pg` driver
- bcrypt for password hashing, express-session for the login cookie
- Cloudinary for video and image uploads
- Plain HTML, CSS and JavaScript (no framework, no build step)

## Structure

```
server.js            Express server: sessions, routes, the protected /studio page
auth.js              Login, sign-out and the requireLogin guard
posts.js             Posts API (read for everyone; add, edit, delete when signed in)
comments.js          Comments API
uploads.js           Signs uploads to Cloudinary
db.js                Shared connection pool to Neon
db/                  schema.sql and the placeholder works
scripts/setup-db.js  Creates the tables and seeds the placeholder works
scripts/create-user.js  Creates or updates the studio login (bcrypt hash)
views/studio.html    The studio page (only sent to a signed-in user)
neon.ts              Neon project config (used by the Neon CLI)
public/index.html    Page shell and the Home column
public/login.html    Sign-in page
public/css/          base (design system), home, work, cube, menu
public/js/           app (entry), works, player, cube, menu, comments, account, studio, fibres
public/data/tags.json  The fixed tag list (placeholder until the final list)
```
