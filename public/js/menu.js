// Zoom-out menu: the cube "unfolds" into a flat map of every column and level.
// This is also the brief's post listing: each work column is a post.
// Above the map sits the tag filter. Opens with Space, Enter or the Overview
// button; closes with Esc or the same keys.

import { esc } from './works.js';

// Wraps every match of `word` in <mark>, escaping the rest of the text
function highlight(text, word) {
  const pattern = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let html = '';
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    html += esc(text.slice(last, match.index)) + `<mark>${esc(match[0])}</mark>`;
    last = match.index + match[0].length;
  }
  return html + esc(text.slice(last));
}

export function initMenu(nav, works, tags) {
  const cube = document.getElementById('cube');
  const html = document.documentElement;

  // ---------- Build the map from the cube itself ----------
  const map = nav.columns.map((column, c) => `
    <li class="map__col">
      <button class="map__title" data-col="${c}" data-level="0">
        <span class="label">${c === 0 ? 'Start' : `Work ${c}`}</span>
        ${esc(column.dataset.title)}
      </button>
      <ol class="map__levels">
        ${nav.grid[c].map((panel, l) => `
          <li><button class="map__level" data-col="${c}" data-level="${l}">${esc(panel.dataset.level)}</button></li>`).join('')}
      </ol>
    </li>`).join('');

  const textNav = nav.columns.map((column, c) =>
    `<li><button data-col="${c}" data-level="0">${esc(column.dataset.title)}</button></li>`).join('');

  document.body.insertAdjacentHTML('beforeend', `
    <div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Overview of all works" inert>
      <div class="menu__inner">
        <header class="menu__head">
          <span class="label label--accent">Overview</span>
          <button class="btn menu__close" type="button">Close · Esc</button>
        </header>
        <nav aria-label="All columns"><ul class="menu__text-nav">${textNav}</ul></nav>
        <section class="filter" aria-labelledby="filter-title">
          <h2 class="label" id="filter-title">Filter by tool, skill or role</h2>
          <div class="filter__tags">
            ${tags.map((tag) => `<button type="button" class="filter__tag" aria-pressed="false" data-tag="${esc(tag)}">${esc(tag)}</button>`).join('')}
          </div>
          <div class="filter__results" aria-live="polite"></div>
        </section>
        <ol class="map">${map}</ol>
      </div>
    </div>`);

  const menu = document.getElementById('menu');

  // The overview button: a small 3D cube, slowly turning, in the navigation bar
  document.querySelector('.navbar').insertAdjacentHTML('beforeend', `
    <button class="overview" type="button" aria-controls="menu" aria-expanded="false" aria-label="Overview of all works (Space)">
      <span class="mini-cube" aria-hidden="true">
        <i class="mini-cube__face mini-cube__face--front"></i>
        <i class="mini-cube__face mini-cube__face--back"></i>
        <i class="mini-cube__face mini-cube__face--left"></i>
        <i class="mini-cube__face mini-cube__face--right"></i>
        <i class="mini-cube__face mini-cube__face--top"></i>
        <i class="mini-cube__face mini-cube__face--bottom"></i>
      </span>
      <span class="overview__hint" aria-hidden="true">Overview<span class="overview__key"> (press space)</span></span>
    </button>`);
  const toggleBtn = document.querySelector('.overview');

  // ---------- Open and close ----------
  let lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    // Mark where the visitor is right now
    const { col, level } = nav.state;
    menu.querySelectorAll('[data-col]').forEach((b) => {
      const here = Number(b.dataset.col) === col;
      b.classList.toggle('is-here', here && (b.classList.contains('map__level') ? Number(b.dataset.level) === level : true));
    });
    html.classList.add('menu-open');
    menu.inert = false;
    cube.inert = true; // the cube behind can't be clicked or tabbed to
    toggleBtn.setAttribute('aria-expanded', 'true');
    menu.querySelector('.menu__close').focus();
  }

  function close() {
    html.classList.remove('menu-open');
    menu.inert = true;
    cube.inert = false;
    toggleBtn.setAttribute('aria-expanded', 'false');
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  const isOpen = () => html.classList.contains('menu-open');

  toggleBtn.addEventListener('click', () => (isOpen() ? close() : open()));
  menu.querySelector('.menu__close').addEventListener('click', close);

  // Any button with data-col jumps to that column and level
  // (and, for "Read more", to one paragraph: data-target)
  menu.addEventListener('click', (e) => {
    const target = e.target.closest('[data-col]');
    if (!target) return;
    close();
    nav.goTo(Number(target.dataset.col), Number(target.dataset.level), target.dataset.target);
  });

  // ---------- Filter ----------
  const results = menu.querySelector('.filter__results');
  const tagButtons = [...menu.querySelectorAll('.filter__tag')];

  // Every process block that mentions the tag, with which work it belongs to.
  // Works are columns 1, 2, 3… in the cube (column 0 is Home).
  function findBlocks(tag) {
    const word = tag.toLowerCase();
    return works.flatMap((work, w) => work.process.map((block, b) => ({
      work,
      col: w + 1,
      id: `${work.slug}-block-${b}`,
      text: block.type === 'list' ? block.items.join(' · ') : block.text,
    }))).filter((block) => block.text.toLowerCase().includes(word));
  }

  function showResults(tag) {
    tagButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tag === tag)));
    if (!tag) { results.innerHTML = ''; return; }

    const blocks = findBlocks(tag);
    results.innerHTML = blocks.length
      ? `<ol class="filter__list">${blocks.map((block) => {
          const level = nav.grid[block.col].findIndex((p) => p.dataset.level === 'Process');
          return `
            <li class="filter__item">
              <span class="label label--accent">${esc(block.work.title)}</span>
              <p>${highlight(block.text, tag)}</p>
              <button type="button" class="btn btn--quiet" data-col="${block.col}" data-level="${level}" data-target="${block.id}">Read more →</button>
            </li>`;
        }).join('')}</ol>`
      : `<p class="muted">No process notes mention ${esc(tag)} yet.</p>`;
  }

  tagButtons.forEach((btn) => btn.addEventListener('click', () => {
    // Clicking the active tag again clears the filter
    const active = btn.getAttribute('aria-pressed') === 'true';
    showResults(active ? null : btn.dataset.tag);
  }));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) { close(); return; }
    if (e.key !== ' ' && e.key !== 'Enter') return;
    // Space and Enter keep their normal job on links, buttons, fields and the video
    if (e.target.closest('a, button, input, textarea, select, video, [contenteditable]')) return;
    e.preventDefault();
    isOpen() ? close() : open();
  });
}
