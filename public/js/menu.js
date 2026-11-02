// Zoom-out menu: the cube "unfolds" into a flat map of every column and level.
// This is also the brief's post listing: each work column is a post.
// Opens with Space, Enter or the Overview button; closes with Esc or the same keys.

import { esc } from './works.js';

export function initMenu(nav) {
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
        <!-- The tag filter goes here in Part 3 -->
        <ol class="map">${map}</ol>
      </div>
    </div>`);

  const menu = document.getElementById('menu');

  // The Overview button lives in the header, top right
  document.querySelector('.site-header__right').insertAdjacentHTML('beforeend',
    `<button class="btn btn--quiet menu-toggle" type="button" aria-controls="menu" aria-expanded="false">
       <span class="menu-toggle__icon" aria-hidden="true"></span>Overview
     </button>`);
  const toggleBtn = document.querySelector('.menu-toggle');

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
  menu.addEventListener('click', (e) => {
    const target = e.target.closest('[data-col]');
    if (!target) return;
    close();
    nav.goTo(Number(target.dataset.col), Number(target.dataset.level));
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) { close(); return; }
    if (e.key !== ' ' && e.key !== 'Enter') return;
    // Space and Enter keep their normal job on links, buttons, fields and the video
    if (e.target.closest('a, button, input, textarea, select, video, [contenteditable]')) return;
    e.preventDefault();
    isOpen() ? close() : open();
  });
}
