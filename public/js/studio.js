// Studio: Axel adds, edits and deletes works, and uploads media to Cloudinary.
import { esc } from './works.js';

const list = document.getElementById('work-list');
const editor = document.getElementById('editor');
const form = document.getElementById('post-form');
const message = document.getElementById('form-message');

let posts = [];      // all works, as loaded from the server
let current = null;  // the work being edited (null = a new one)
let blocks = [];     // process blocks being edited
let images = [];     // reference images being edited
let tagList = [];    // the fixed tag list
let approved = '';   // the approved AI summary (the only summary that gets published)

// ---------- Talking to the server ----------

// fetch() wrapper: sends JSON, and goes back to the login page if the session ran out
async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) {
    location.href = '/login';
    throw new Error('Signed out');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function showMessage(text, ok = false) {
  message.textContent = text;
  message.classList.toggle('is-ok', ok);
}

// ---------- List of works ----------

async function loadPosts() {
  posts = await api('/api/posts');
  list.innerHTML = posts.length
    ? posts.map((p) => `
        <li class="work-list__item ${current && current.id === p.id ? 'is-current' : ''}">
          <span class="work-list__pos">${esc(p.position)}</span>
          <span class="work-list__title">${esc(p.title)}<small>${esc(p.year ?? '')}</small></span>
          <button class="btn btn--quiet" type="button" data-edit="${p.id}">Edit</button>
        </li>`).join('')
    : '<li class="muted">No works yet. Add the first one.</li>';
}

list.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-edit]');
  if (btn) openEditor(posts.find((p) => p.id === Number(btn.dataset.edit)));
});

document.getElementById('new-work').addEventListener('click', () => openEditor(null));

// ---------- Editor ----------

function openEditor(post) {
  current = post;
  const p = post || {
    title: '', slug: '', year: new Date().getFullYear(), video_url: '', summary: '', tags: [],
    // New works go last in the cube by default
    position: posts.reduce((max, w) => Math.max(max, w.position), 0) + 1,
  };

  form.title.value = p.title;
  form.slug.value = p.slug;
  form.year.value = p.year ?? '';
  form.position.value = p.position;
  form.video_url.value = p.video_url;
  approved = p.summary || '';
  draftEl.value = approved; // start from the published text, so small tweaks are easy

  // Copies, so Cancel leaves the saved work untouched
  blocks = structuredClone(p.process || []);
  images = structuredClone(p.reference_images || []);

  document.getElementById('editor-label').textContent = post ? `Editing: ${post.title}` : 'New work';
  document.getElementById('delete-work').hidden = !post;
  showMessage('');
  renderVideo();
  renderBlocks();
  renderImages();
  renderTags(p.tags);
  renderSummary();
  loadPosts(); // refresh the highlight in the list

  editor.hidden = false;
  form.title.focus();
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeEditor() {
  current = null;
  editor.hidden = true;
  loadPosts();
}

document.getElementById('cancel-edit').addEventListener('click', closeEditor);

// ---------- Video ----------

const videoPreview = document.getElementById('video-preview');

function renderVideo() {
  const url = form.video_url.value.trim();
  videoPreview.hidden = !url;
  if (url) videoPreview.src = url;
  else videoPreview.removeAttribute('src');
}
form.video_url.addEventListener('change', renderVideo);

document.getElementById('video-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    showMessage('Uploading video…');
    const result = await upload(file, document.getElementById('video-progress'));
    // Ask Cloudinary for an .mp4 version: it converts on the fly, so
    // .mov files from a phone or editor still play in every browser
    form.video_url.value = result.secure_url.replace(/\.[^./]+$/, '.mp4');
    renderVideo();
    showMessage('Video uploaded. Remember to save.', true);
  } catch (err) {
    showMessage(err.message);
  }
  e.target.value = '';
});

// ---------- Process blocks ----------

const blocksEl = document.getElementById('blocks');

function renderBlocks() {
  blocksEl.innerHTML = blocks.map((b, i) => `
    <li class="block">
      <div class="block__head">
        <span class="label">${b.type === 'list' ? 'List · one item per line' : 'Text'}</span>
        <span class="block__tools">
          <button type="button" data-move="-1" data-i="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-move="1" data-i="${i}" aria-label="Move down" ${i === blocks.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" data-remove="${i}" aria-label="Remove block">✕</button>
        </span>
      </div>
      <textarea data-block="${i}" rows="${b.type === 'list' ? 4 : 5}" aria-label="Block ${i + 1}">${
        esc(b.type === 'list' ? (b.items || []).join('\n') : b.text || '')
      }</textarea>
    </li>`).join('') || '<li class="muted">No blocks yet.</li>';
}

// Typing updates the blocks array straight away, so moving blocks keeps the text
blocksEl.addEventListener('input', (e) => {
  const i = e.target.dataset.block;
  if (i === undefined) return;
  if (blocks[i].type === 'list') blocks[i].items = e.target.value.split('\n');
  else blocks[i].text = e.target.value;
});

blocksEl.addEventListener('click', (e) => {
  const move = e.target.closest('[data-move]');
  const remove = e.target.closest('[data-remove]');
  if (move) {
    const i = Number(move.dataset.i);
    const j = i + Number(move.dataset.move);
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    renderBlocks();
  }
  if (remove) {
    blocks.splice(Number(remove.dataset.remove), 1);
    renderBlocks();
  }
});

document.querySelectorAll('[data-add-block]').forEach((btn) =>
  btn.addEventListener('click', () => {
    blocks.push(btn.dataset.addBlock === 'list' ? { type: 'list', items: [] } : { type: 'text', text: '' });
    renderBlocks();
    blocksEl.querySelector('li:last-child textarea').focus();
  })
);

// ---------- Reference images ----------

const imagesEl = document.getElementById('images');

function renderImages() {
  imagesEl.innerHTML = images.map((img, i) => `
    <li class="image">
      <img src="${esc(img.url)}" alt="">
      <div class="field">
        <label for="alt-${i}">Alt text (describe the image)</label>
        <input id="alt-${i}" data-alt="${i}" value="${esc(img.alt)}">
      </div>
      <button class="btn btn--quiet" type="button" data-remove-image="${i}">Remove</button>
    </li>`).join('');
}

imagesEl.addEventListener('input', (e) => {
  const i = e.target.dataset.alt;
  if (i !== undefined) images[i].alt = e.target.value;
});

imagesEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-image]');
  if (!btn) return;
  images.splice(Number(btn.dataset.removeImage), 1);
  renderImages();
});

document.getElementById('image-files').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  const progress = document.getElementById('image-progress');
  try {
    for (const [n, file] of files.entries()) {
      showMessage(`Uploading image ${n + 1} of ${files.length}…`);
      const result = await upload(file, progress);
      images.push({ url: result.secure_url, alt: '' });
      renderImages();
    }
    showMessage('Images uploaded. Add alt texts, then save.', true);
  } catch (err) {
    showMessage(err.message);
  }
  e.target.value = '';
});

// ---------- Uploading to Cloudinary ----------

// 1. Ask our server for a signature. 2. Send the file straight to Cloudinary with it.
// XMLHttpRequest is used instead of fetch() because it reports upload progress.
async function upload(file, progressEl) {
  const sig = await api('/api/upload-signature');

  const data = new FormData();
  data.append('file', file);
  data.append('api_key', sig.apiKey);
  data.append('timestamp', sig.timestamp);
  data.append('signature', sig.signature);
  data.append('folder', sig.folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // "auto" lets Cloudinary work out whether the file is a video or an image
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) progressEl.value = (e.loaded / e.total) * 100;
    });
    xhr.addEventListener('load', () => {
      progressEl.hidden = true;
      const result = JSON.parse(xhr.responseText);
      if (xhr.status === 200) resolve(result);
      else reject(new Error(`Upload failed: ${result.error?.message || xhr.status}`));
    });
    xhr.addEventListener('error', () => {
      progressEl.hidden = true;
      reject(new Error('Upload failed: no connection to Cloudinary.'));
    });
    progressEl.value = 0;
    progressEl.hidden = false;
    xhr.send(data);
  });
}

// ---------- Tags ----------

function renderTags(selected) {
  // Also show tags a work has that aren't on the list, so nothing gets lost
  const all = [...new Set([...tagList, ...selected])];
  document.getElementById('tags').innerHTML = all.map((tag) => `
    <label class="tag-option">
      <input type="checkbox" name="tags" value="${esc(tag)}" ${selected.includes(tag) ? 'checked' : ''}>
      <span>${esc(tag)}</span>
    </label>`).join('');
}

// ---------- AI summary ----------

const draftEl = document.getElementById('f-draft');
const draftStatus = document.getElementById('draft-status');

function renderSummary() {
  document.getElementById('approved-summary').textContent = approved || 'Nothing approved yet.';
  document.getElementById('remove-summary').hidden = !approved;
  draftStatus.textContent = draftEl.value.trim() && draftEl.value.trim() !== approved ? 'Draft not approved yet' : '';
}
draftEl.addEventListener('input', renderSummary);

document.getElementById('generate-summary').addEventListener('click', async (e) => {
  const button = e.currentTarget;
  button.disabled = true;
  button.textContent = 'Writing…';
  try {
    // Sends what's in the form right now, saved or not
    const { draft } = await api('/api/summary', {
      method: 'POST',
      body: {
        title: form.title.value,
        process: blocks,
        tags: [...form.querySelectorAll('input[name="tags"]:checked')].map((c) => c.value),
      },
    });
    draftEl.value = draft;
    renderSummary();
    draftEl.focus();
  } catch (err) {
    showMessage(err.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Generate summary';
  }
});

document.getElementById('approve-summary').addEventListener('click', () => {
  approved = draftEl.value.trim();
  renderSummary();
  showMessage(approved ? 'Summary approved. Save to publish it.' : 'The draft is empty.', Boolean(approved));
});

document.getElementById('remove-summary').addEventListener('click', () => {
  approved = '';
  renderSummary();
  showMessage('Summary removed. Save to update the site.', true);
});

// ---------- Save and delete ----------

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.title.value.trim()) {
    showMessage('The work needs a title.');
    form.title.focus();
    return;
  }
  // Alt text describes an image to people who can't see it, so every image needs one
  const missingAlt = images.findIndex((img) => !img.alt.trim());
  if (missingAlt !== -1) {
    showMessage('Add an alt text to every reference image before saving.');
    document.getElementById(`alt-${missingAlt}`).focus();
    return;
  }

  const body = {
    title: form.title.value,
    slug: form.slug.value,
    year: form.year.value,
    position: form.position.value,
    video_url: form.video_url.value.trim(),
    summary: approved,
    process: blocks,
    reference_images: images,
    tags: [...form.querySelectorAll('input[name="tags"]:checked')].map((c) => c.value),
  };

  try {
    const saved = current
      ? await api(`/api/posts/${current.id}`, { method: 'PUT', body })
      : await api('/api/posts', { method: 'POST', body });
    current = saved;
    form.slug.value = saved.slug;
    document.getElementById('editor-label').textContent = `Editing: ${saved.title}`;
    document.getElementById('delete-work').hidden = false;
    await loadPosts();
    showMessage('Saved. It is live on the site.', true);
  } catch (err) {
    showMessage(err.message);
  }
});

document.getElementById('delete-work').addEventListener('click', async () => {
  if (!current) return;
  if (!confirm(`Delete "${current.title}"? Its comments are deleted too. This cannot be undone.`)) return;
  try {
    await api(`/api/posts/${current.id}`, { method: 'DELETE' });
    closeEditor();
  } catch (err) {
    showMessage(err.message);
  }
});

document.getElementById('sign-out').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  location.href = '/';
});

// ---------- Start ----------
tagList = await (await fetch('/data/tags.json')).json();
loadPosts();
