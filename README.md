# Axel af Ugglas — Portfolio

A cinematic portfolio of Axel af Ugglas's AI video work and CV, explored like an unfolding cube.
Built for the Berghs individual blog project (Programming & Methods, ACE2627).

- **Audience:** employers and creative opportunities.
- **Idea:** one Home column (intro and CV) and one column per video work. Each work is a blog post.
- **Stack:** Node.js + Express, plain HTML/CSS/JavaScript (no framework, no build step), PostgreSQL on Neon.

## What was built

| # | Brief task | How the site meets it |
|---|---|---|
| 1 | Post listing; open a post and return | Each video work is a post. The **Overview** menu (Space, Enter or the button) lists every post as a cube map; click one to open it, open the menu again or click the logo to go back. |
| 2 | Add a post | The **studio** (`/studio`, signed in only) adds, edits and deletes posts. Stored in Neon, so they survive a refresh. |
| 2 PD | Comments stored in a database | Visitors comment at the bottom of each post. First name, last name and email are required; comments are saved in Neon and appear at once. Only the first name is shown. |
| 3 | Readable text, large and small screens | 18 px body text (17 px on phones), small labels, layouts tested from 375 px phones to 1920 px screens. Swipe navigation on touch screens. |
| 4 | Search, filter or theme switcher | **Tag filter** in the Overview menu: pick a tool, skill or role to see every process paragraph that mentions it, labelled by work. "Read more" opens the work at that paragraph. |
| 5 | External API | **NOAA Kp index** (Earth's magnetic field). The header shows "Earth's magnetic field · Kp 2 · calm" next to a tiny purple circle that trembles faster and wider as Kp rises from 0 to 9; the background vapour also flows a little faster in a disturbed field. |
| 6 | Sign in, sign out; sign-in required to add posts | Discreet **login** link at the bottom of the CV. Username and password, bcrypt-hashed, kept in a session cookie. All write routes check the session. |
| 7 PD | AI API | **Automatic summary** (option d) with Claude through the Anthropic API. In the studio Axel generates a draft from the title, process and tags, edits it and approves it. Only the approved text is published, under the video. |
| 8 PD | Posts and comments in Neon | Posts, comments and the login live in Neon Postgres (`db/schema.sql`). |

Other features: the site is a 3D cube drawn with thin neon-purple double lines that drift and rebuild themselves (90% of the screen, full screen on phones) and turns 90° when you move; the background image comes alive with WebGL: turquoise vapour seeps in from the edges like paint in dark water, the mouse stirs up veins of turquoise light beneath the surface, and a click drops a small bloom of turquoise ink that dissolves; navigation by arrow keys, phone swipes and two-finger trackpad swipes; a navigation bar with a dot indicator, arrow keys and a small overview cube; a custom video player; and uploads of video and reference images to Cloudinary from the studio.

## What was left out on purpose

- **Public sign-up and more than one user.** Only Axel signs in; his account is made with a script.
- **Login rate limiting.** There is no lock-out after many wrong passwords. A public launch should add it (e.g. `express-rate-limit`).
- **Persistent sessions.** Sessions are kept in the server's memory, so restarting the server signs Axel out. A live site would store them in Postgres (`connect-pg-simple`).
- **Comment moderation and spam protection.** Comments can't be deleted from the studio yet, and there is no captcha.
- **Saved summary drafts.** Only the approved summary is stored; a draft lives in the studio until it is approved.
- **Very large videos.** Uploads go to Cloudinary in one piece, which the free plan limits to 100 MB per video.
- **Hosting.** The brief doesn't require the site to be online, so it runs locally.
- **Build step and framework.** Left out on purpose so every part can be read and explained directly.

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer.

1. Install the packages:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the values (see **Configure the services** below).
3. Create the tables and add three placeholder works:
   ```bash
   npm run db:setup
   ```
4. Create the studio login (it asks for a username and a password of at least 10 characters):
   ```bash
   npm run create-user
   ```
5. Start the server and open http://localhost:3000:
   ```bash
   npm start
   ```

## Configure the services

All secrets live in `.env`, which is listed in `.gitignore` and never committed. `.env.example` shows every variable with a placeholder:

```bash
DATABASE_URL=postgresql://user:password@host-pooler/dbname?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:password@host/dbname?sslmode=require
SESSION_SECRET=replace-with-a-long-random-string
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=replace-with-your-api-secret
ANTHROPIC_API_KEY=sk-ant-replace-me
ANTHROPIC_MODEL=claude-opus-5-5
PORT=3000
```

### Neon (database)

1. Create a free project at https://neon.tech.
2. Copy the **pooled** connection string (host ends in `-pooler`) into `DATABASE_URL`, and the **direct** one into `DATABASE_URL_UNPOOLED`.
   With the Neon CLI, `npx neon@latest env pull` writes both for you.
3. Run `npm run db:setup`. The app uses the pooled address; the setup script uses the direct one, as Neon recommends for schema changes.

### Session secret

`SESSION_SECRET` signs the login cookie so it can't be forged. Any long random string works:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Cloudinary (video and image uploads)

1. Create a free account at https://cloudinary.com.
2. In the console, open **Settings → API Keys** and copy the cloud name, API key and API secret
   into `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`.

Files go straight from the browser to Cloudinary. The server only signs each upload, so the API secret never reaches the browser.

### Anthropic (AI summary)

1. Create an account at https://console.anthropic.com and add credit (a summary costs about one cent).
2. Under **API Keys**, create a key and put it in `ANTHROPIC_API_KEY`.
3. Optional: choose another Claude model with `ANTHROPIC_MODEL` (default `claude-opus-5-5`).

The server calls the Messages API through the official `@anthropic-ai/sdk` package, so the key never reaches the browser.

### NOAA (Earth's magnetic field)

No account or key. The server reads `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json` and caches it for 10 minutes, so visitors never call NOAA directly.

## How to use it

**Visitors**
- **Arrow keys**, the arrows in the bar at the bottom, a **two-finger trackpad swipe** or a **phone swipe**: left/right turn the cube between Home and the works (always landing at the top), up/down go through a column. Tall faces scroll first.
- **Space, Enter** or the small **cube** at the bottom opens the overview map and the tag filter. **Esc** closes it.
- **Move the mouse** over the page to stir the water; **click** to drop turquoise ink into it.
- Visitors who ask their system for reduced motion get the still image.

**Axel**
- Click **login** at the bottom of the CV, sign in, and you are in the studio.
- **+ New work**: fill in the title, year and position (the order in the cube), upload a video, write process blocks (text or lists; reorder with the arrows), upload reference images (alt text required) and pick tags.
- **Generate summary** writes a draft from the title, process and tags. Edit it, click **Approve draft**, then **Save**.
- The tag list for the filter and studio is `public/data/tags.json`.
- The background is `public/img/background.jpg`. Replace the file to change it; the animation uses whatever image is there.

## Project structure

```
server.js               Express server: sessions, routes, the protected /studio page
auth.js                 Login, sign-out and the requireLogin guard
posts.js                Posts API (read for everyone; add, edit, delete when signed in)
comments.js             Comments API (only first names are sent to visitors)
uploads.js              Signs uploads to Cloudinary
kp.js                   Fetches and caches the NOAA Kp index
summary.js              Asks Claude (Anthropic API) for a summary draft
db.js                   Shared connection pool to Neon
db/schema.sql           Tables: users, posts, comments
db/seed-works.json      Placeholder works added by db:setup
scripts/setup-db.js     Creates the tables and seeds the placeholder works
scripts/create-user.js  Creates or updates the studio login (bcrypt hash)
neon.ts                 Neon project config (used by the Neon CLI)
views/studio.html       The studio page (only sent to a signed-in user)
public/index.html       Page shell, Home column (intro and CV)
public/login.html       Sign-in page
public/css/             base (design system), home, work, cube, menu, field, studio
public/js/              app (entry), works, player, cube (3D turns, swipes), menu,
                        comments, field (Kp readout), water (WebGL background),
                        account, studio
public/img/             background.jpg, the background image
public/data/tags.json   The fixed tag list
```

## API

| Method | Route | Who | What |
|---|---|---|---|
| GET | `/api/posts` | everyone | All works in cube order |
| POST | `/api/posts` | signed in | Add a work |
| PUT | `/api/posts/:id` | signed in | Edit a work |
| DELETE | `/api/posts/:id` | signed in | Delete a work and its comments |
| GET | `/api/posts/:id/comments` | everyone | Comments (first name, text, date) |
| POST | `/api/posts/:id/comments` | everyone | Add a comment |
| POST | `/api/login` · `/api/logout` | everyone | Sign in · sign out |
| GET | `/api/me` | everyone | Am I signed in? |
| GET | `/api/kp` | everyone | Current Kp index (cached) |
| POST | `/api/summary` | signed in | AI summary draft |
| GET | `/api/upload-signature` | signed in | Signature for a Cloudinary upload |

## Security notes

- Passwords are stored only as bcrypt hashes (cost 12).
- The session cookie is `httpOnly` and `sameSite=lax`, and the session id is renewed at login.
- Every SQL query uses placeholders (`$1`, `$2`), which prevents SQL injection.
- Everything shown on the page is HTML-escaped, so a post or comment can't inject scripts.
- The server validates every field again, whatever the browser sent.
- API keys are read from `.env` on the server and never sent to the browser.

## Presentation

The slides are added to this repo as `presentation/` before hand-in.
