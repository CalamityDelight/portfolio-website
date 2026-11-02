# Axel af Ugglas — Portfolio

A cinematic portfolio of Axel af Ugglas's AI video work and CV, explored like an unfolding cube.
Built for the Berghs individual blog project (Programming & Methods, ACE2627).

> Work in progress. The full README (what was built, what was left out, service setup) comes in Part 3.

## Run it locally

```bash
npm install
npm start
```

Then open http://localhost:3000.

## How to move around

- **Arrow keys** or the on-screen arrows: left/right switch between Home and the works, up/down go through a column.
- **Swipe** on a phone does the same.
- **Space, Enter** or the **Overview** button opens the zoom-out map of every work.

## Adding a work (for now)

Until the studio arrives in Part 2, works live in `public/data/works.json`. Copy one entry and change it:

```json
{
  "slug": "my-new-work",
  "position": 4,
  "title": "My New Work",
  "year": 2026,
  "video_url": "https://link-to-video.mp4",
  "summary": "Short summary text.",
  "process": [
    { "type": "text", "text": "A paragraph about the process." },
    { "type": "list", "items": ["Step one", "Step two"] }
  ],
  "reference_images": [
    { "url": "https://link-to-image.jpg", "alt": "What the image shows" }
  ],
  "tags": ["Tool", "Skill", "Role"]
}
```

- `slug`: unique, lowercase, dashes instead of spaces. Used in the URL.
- `position`: sets the order in the cube (1 sits next to Home).
- Leave `video_url` or an image `url` empty (`""`) to show a placeholder.

## Stack

- Node.js + Express
- Plain HTML, CSS and JavaScript (no framework, no build step)

## Structure

```
server.js            Express server
public/index.html    Page shell and the Home column
public/css/          base (design system), home, work, cube, menu
public/js/           app (entry), works, player, cube, menu, fibres
public/data/         works.json (placeholder works, replaced by the database in Part 2)
```
