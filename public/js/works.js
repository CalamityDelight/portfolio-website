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
         <video src="${esc(work.video_url)}" preload="metadata" playsinline aria-label="Video: ${esc(work.title)}"></video>
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

// The approved summary is plain text: paragraphs, then "Tools: a, b" and
// "Skills: c, d" lines. Split it so the lists can be shown as pills.
function parseSummary(summary) {
  const result = { paragraphs: [], tools: [], skills: [] };
  for (const line of String(summary || '').split('\n').map((l) => l.trim()).filter(Boolean)) {
    const list = line.match(/^(tools|skills)\s*:\s*(.+)$/i);
    if (list) result[list[1].toLowerCase()] = list[2].split(',').map((x) => x.trim().replace(/\.$/, '')).filter(Boolean);
    else result.paragraphs.push(line);
  }
  return result;
}

const pills = (items) => `<ul class="word-list">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;

// Level 2: AI summary, shown as a designed card rather than plain text
function summaryPanel(work) {
  const { paragraphs, tools, skills } = parseSummary(work.summary);
  // No Tools/Skills lines in the summary? Fall back to the work's tags.
  const lists = tools.length || skills.length
    ? `${tools.length ? `<h3 class="label">Tools</h3>${pills(tools)}` : ''}
       ${skills.length ? `<h3 class="label">Skills</h3>${pills(skills)}` : ''}`
    : work.tags.length ? `<h3 class="label">Tools, skills and roles</h3>${pills(work.tags)}` : '';

  return `
    <article class="panel" data-level="AI summary">
      <div class="panel__inner">
        <section class="summary">
          <header class="summary__head">
            <span class="label label--accent">AI summary</span>
            <span class="summary__graph" aria-hidden="true"></span>
          </header>
          ${paragraphs.length
            ? paragraphs.map((p) => `<p class="summary__text">${esc(p)}</p>`).join('')
            : '<p class="summary__text muted">Summary coming soon.</p>'}
          ${lists}
          <p class="summary__note">Drafted with AI from Axel's process notes, edited and approved by Axel.</p>
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

// Level 5: comments. js/comments.js loads the list and handles the form.
function commentsPanel(work) {
  const f = work.slug; // slugs only contain a-z, 0-9 and dashes, so they are safe in ids
  return `
    <article class="panel" data-level="Comments">
      <div class="panel__inner comments">
        <span class="label label--accent">Comments</span>
        <h2>Leave a comment</h2>
        <ol class="comment-list" aria-live="polite"></ol>
        <form class="comment-form" data-post-id="${esc(work.id)}" novalidate>
          <div class="field">
            <label for="${f}-first">First name</label>
            <input id="${f}-first" name="first_name" required maxlength="80" autocomplete="given-name">
          </div>
          <div class="field">
            <label for="${f}-last">Last name</label>
            <input id="${f}-last" name="last_name" required maxlength="80" autocomplete="family-name">
          </div>
          <div class="field field--wide">
            <label for="${f}-email">Email <span class="field__note">· never shown</span></label>
            <input id="${f}-email" name="email" type="email" required maxlength="200" autocomplete="email">
          </div>
          <div class="field field--wide">
            <label for="${f}-body">Comment</label>
            <textarea id="${f}-body" name="body" rows="4" required maxlength="2000"></textarea>
          </div>
          <p class="form-message field--wide" role="status"></p>
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
}
