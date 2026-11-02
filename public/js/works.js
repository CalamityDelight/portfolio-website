// Loads the works from the server and builds one cube column per work.

// Content can contain characters like < and &. Escaping them stops a post
// or a comment from injecting its own HTML into the page.
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The server reads the posts from Neon, already sorted in Axel's chosen order
export async function loadWorks() {
  const res = await fetch('/api/posts');
  if (!res.ok) throw new Error('Could not load the works');
  return res.json();
}

// Level 1: video with a subtle centred title beneath
function videoPanel(work) {
  const media = work.video_url
    ? `<div class="player">
         <video src="${esc(work.video_url)}" preload="metadata" playsinline></video>
       </div>`
    : `<div class="player player--empty"><span class="label">Video coming soon</span></div>`;

  return `
    <article class="panel" data-level="Video">
      <div class="panel__inner work-video">
        ${media}
        <p class="work-title">
          <span class="label">${esc(work.year)}</span>
          <span class="work-title__name">${esc(work.title)}</span>
        </p>
      </div>
    </article>`;
}

// Level 2: AI summary, shown as a designed card rather than plain text
function summaryPanel(work) {
  const tags = work.tags.map((t) => `<li>${esc(t)}</li>`).join('');
  return `
    <article class="panel" data-level="AI summary">
      <div class="panel__inner">
        <section class="summary">
          <header class="summary__head">
            <span class="label label--accent">AI summary</span>
            <span class="summary__graph" aria-hidden="true"></span>
          </header>
          <p class="summary__text">${esc(work.summary)}</p>
          <h3 class="label">Tools, skills and roles</h3>
          <ul class="tag-list">${tags}</ul>
        </section>
      </div>
    </article>`;
}

// Level 3: process, built from text blocks and list blocks.
// Every block gets an id so the filter's "Read more" can jump straight to it (Part 3).
function processPanel(work) {
  const blocks = work.process.map((block, i) => {
    const id = `${work.slug}-block-${i}`;
    if (block.type === 'list') {
      const items = block.items.map((item) => `<li>${esc(item)}</li>`).join('');
      return `<ul class="process__list" id="${id}">${items}</ul>`;
    }
    return `<p id="${id}">${esc(block.text)}</p>`;
  }).join('');

  return `
    <article class="panel" data-level="Process">
      <div class="panel__inner process">
        <span class="label label--accent">Process</span>
        <h2>${esc(work.title)}</h2>
        ${blocks}
      </div>
    </article>`;
}

// Level 4: reference images (empty url = placeholder tile)
function referencesPanel(work) {
  const images = work.reference_images.map((img) => img.url
    ? `<figure><img src="${esc(img.url)}" alt="${esc(img.alt)}" loading="lazy"></figure>`
    : `<figure class="ref-placeholder" role="img" aria-label="${esc(img.alt)}"><span class="label">Reference</span></figure>`
  ).join('');

  return `
    <article class="panel" data-level="References">
      <div class="panel__inner">
        <span class="label label--accent">References</span>
        ${images
          ? `<div class="refs">${images}</div>`
          : `<p class="muted">No reference images yet.</p>`}
      </div>
    </article>`;
}

// Level 5: comments. Static in Part 1; Part 2 saves them in Neon.
function commentsPanel(work) {
  const f = work.slug;
  return `
    <article class="panel" data-level="Comments">
      <div class="panel__inner comments">
        <span class="label label--accent">Comments</span>
        <h2>Leave a comment</h2>
        <ol class="comment-list">
          <li class="muted">No comments yet.</li>
        </ol>
        <form class="comment-form" data-slug="${esc(f)}">
          <div class="field">
            <label for="${f}-first">First name</label>
            <input id="${f}-first" name="first_name" required autocomplete="given-name">
          </div>
          <div class="field">
            <label for="${f}-last">Last name</label>
            <input id="${f}-last" name="last_name" required autocomplete="family-name">
          </div>
          <div class="field field--wide">
            <label for="${f}-email">Email</label>
            <input id="${f}-email" name="email" type="email" required autocomplete="email">
          </div>
          <div class="field field--wide">
            <label for="${f}-body">Comment</label>
            <textarea id="${f}-body" name="body" rows="4" required></textarea>
          </div>
          <button class="btn" type="submit">Post comment</button>
        </form>
      </div>
    </article>`;
}

export function renderWorks(works, cube) {
  const html = works.map((work) => `
    <section class="column" id="${esc(work.slug)}" data-title="${esc(work.title)}">
      ${videoPanel(work)}
      ${summaryPanel(work)}
      ${processPanel(work)}
      ${referencesPanel(work)}
      ${commentsPanel(work)}
    </section>`).join('');
  cube.insertAdjacentHTML('beforeend', html);

  // Part 1: the form is for show only, so stop it reloading the page
  cube.querySelectorAll('.comment-form').forEach((form) => {
    form.addEventListener('submit', (e) => e.preventDefault());
  });
}
