// Cube navigation. The site is a grid of panels: columns (Home, then one per
// work) and levels (the panels inside a column). Only one panel shows at a time.
// Left/right switches column and always lands at the top; up/down moves level.

const DURATION = 700; // ms, must match the animation length in cube.css

export function initCube(cube) {
  const columns = [...cube.querySelectorAll('.column')];
  const grid = columns.map((col) => [...col.querySelectorAll('.panel')]);
  const state = { col: 0, level: 0, busy: false };

  document.documentElement.classList.add('cube-ready');

  // Panels can take focus (without showing an outline) so screen readers and Tab follow along
  grid.flat().forEach((panel) => panel.setAttribute('tabindex', '-1'));

  // ---------- On-screen arrows and dot indicator ----------
  document.body.insertAdjacentHTML('beforeend', `
    <nav class="arrows" aria-label="Move around the site">
      <button class="arrow arrow--up" data-dir="up" aria-label="Up">↑</button>
      <button class="arrow arrow--left" data-dir="left" aria-label="Previous column">←</button>
      <button class="arrow arrow--down" data-dir="down" aria-label="Down">↓</button>
      <button class="arrow arrow--right" data-dir="right" aria-label="Next column">→</button>
    </nav>
    <div class="dots" aria-hidden="true">
      ${grid.map((panels) => `
        <span class="dots__col">${panels.map(() => '<i></i>').join('')}</span>`).join('')}
    </div>
    <p class="sr-only" aria-live="polite" id="cube-status"></p>`);

  const arrows = document.querySelector('.arrows');
  const dotCols = [...document.querySelectorAll('.dots__col')];
  const status = document.getElementById('cube-status');

  arrows.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dir]');
    if (btn) step(btn.dataset.dir);
  });

  // Only show arrows that lead somewhere (scrolling a tall panel counts)
  function updateArrows() {
    const { col, level } = state;
    const panel = grid[col][level];
    arrows.querySelector('.arrow--left').hidden = col === 0;
    arrows.querySelector('.arrow--right').hidden = col === columns.length - 1;
    arrows.querySelector('.arrow--up').hidden = level === 0 && !canScroll(panel, 'up');
    arrows.querySelector('.arrow--down').hidden = level === grid[col].length - 1 && !canScroll(panel, 'down');
  }
  grid.flat().forEach((panel) => panel.addEventListener('scroll', updateArrows, { passive: true }));

  // Content can grow after load (comments arrive, images load), so check again whenever a panel changes size
  const resizeWatcher = new ResizeObserver(updateArrows);
  grid.flat().forEach((panel) => resizeWatcher.observe(panel.firstElementChild));

  function updateUI() {
    const { col, level } = state;
    updateArrows();

    dotCols.forEach((dc, c) => {
      dc.classList.toggle('is-current', c === col);
      [...dc.children].forEach((dot, l) => dot.classList.toggle('is-active', c === col && l === level));
    });

    // Tell screen readers where we are, and keep the place in the URL so a refresh stays put
    const panel = grid[col][level];
    status.textContent = `${columns[col].dataset.title}: ${panel.dataset.level}`;
    history.replaceState(null, '', `#${columns[col].id}${level ? '/' + level : ''}`);
  }

  // ---------- Moving ----------

  // dir says which way the old panel leaves, so the animation rolls the right way
  function go(col, level, dir) {
    if (state.busy) return;
    if (col === state.col && level === state.level) return;
    const from = grid[state.col][state.level];
    const to = grid[col][level];

    // Stop any video in the panel we leave
    from.querySelectorAll('video').forEach((v) => v.pause());

    to.scrollTop = 0; // always land at the top
    to.classList.add('is-active', `enter-${dir}`);
    from.classList.add(`exit-${dir}`);
    to.focus({ preventScroll: true });

    state.busy = true;
    setTimeout(() => {
      from.classList.remove('is-active', `exit-${dir}`);
      to.classList.remove(`enter-${dir}`);
      state.busy = false;
    }, DURATION);

    state.col = col;
    state.level = level;
    updateUI();
  }

  function move(dir) {
    const { col, level } = state;
    if (dir === 'right' && col < columns.length - 1) go(col + 1, 0, 'right');
    if (dir === 'left' && col > 0) go(col - 1, 0, 'left');
    if (dir === 'down' && level < grid[col].length - 1) go(col, level + 1, 'down');
    if (dir === 'up' && level > 0) go(col, level - 1, 'up');
  }

  // A tall panel (like the CV) scrolls first; only at its edge do we change level
  function canScroll(panel, dir) {
    if (dir === 'down') return panel.scrollTop + panel.clientHeight < panel.scrollHeight - 2;
    return panel.scrollTop > 2;
  }

  // One step in a direction: a tall panel scrolls first, then we move on
  function step(dir) {
    const panel = grid[state.col][state.level];
    if ((dir === 'up' || dir === 'down') && canScroll(panel, dir)) {
      panel.scrollBy({ top: (dir === 'down' ? 1 : -1) * panel.clientHeight * 0.8, behavior: 'smooth' });
    } else {
      move(dir);
    }
  }

  // ---------- Keyboard ----------
  const keyDirs = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

  window.addEventListener('keydown', (e) => {
    const dir = keyDirs[e.key];
    if (!dir) return;
    // Leave arrow keys alone while typing or using a slider
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (document.documentElement.classList.contains('menu-open')) return;
    e.preventDefault();
    step(dir);
  });

  // ---------- Swipe ----------
  let touch = null;

  cube.addEventListener('touchstart', (e) => {
    if (e.target.closest('input, textarea')) return;
    const panel = grid[state.col][state.level];
    touch = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      // Remember if the panel was already at an edge when the swipe began,
      // so a normal scroll to the bottom doesn't also jump a level
      atTop: !canScroll(panel, 'up'),
      atBottom: !canScroll(panel, 'down'),
    };
  }, { passive: true });

  cube.addEventListener('touchend', (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x;
    const dy = e.changedTouches[0].clientY - touch.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      move(dx < 0 ? 'right' : 'left'); // finger moves left = go right
    } else if (Math.abs(dy) > 60) {
      if (dy < 0 && touch.atBottom) move('down');
      if (dy > 0 && touch.atTop) move('up');
    }
    touch = null;
  });

  // ---------- Links into the cube ----------

  // Reads "#slug" or "#slug/2" and returns { col, level }
  function parseHash() {
    const [id, lvl] = location.hash.slice(1).split('/');
    const col = Math.max(0, columns.findIndex((c) => c.id === id));
    const level = Math.min(Number(lvl) || 0, grid[col].length - 1);
    return { col, level };
  }

  // Start wherever the URL points, without animation
  const start = parseHash();
  state.col = start.col;
  state.level = start.level;
  grid[start.col][start.level].classList.add('is-active');
  updateUI();

  // Links like the logo (#home) jump straight there
  window.addEventListener('hashchange', () => {
    const { col, level } = parseHash();
    go(col, level, col >= state.col ? 'right' : 'left');
  });

  document.querySelectorAll('[data-action="browse"]').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (columns.length > 1) go(1, 0, 'right');
    })
  );

  // Other parts (the zoom-out menu) move the cube through this
  return {
    goTo(col, level = 0) {
      if (col === state.col) go(col, level, level >= state.level ? 'down' : 'up');
      else go(col, level, col > state.col ? 'right' : 'left');
    },
    get state() { return { col: state.col, level: state.level }; },
    columns,
    grid,
  };
}
