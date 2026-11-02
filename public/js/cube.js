// Cube navigation. The site is a grid of panels: columns (Home, then one per
// work) and levels (the panels inside a column). Each panel is a face of a cube,
// and only one face shows at a time. Moving turns the cube 90° in 3D:
// left/right switches column (always landing at the top), up/down changes level.

const DURATION = 1300; // ms for one turn of the cube: slow and fluid

export function initCube(cube, { particles } = {}) {
  const box = cube.querySelector('.cube__box');
  const columns = [...cube.querySelectorAll('.column')];
  const grid = columns.map((col) => [...col.querySelectorAll('.panel')]);
  const state = { col: 0, level: 0, busy: false };
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  root.classList.add('cube-ready');

  // Panels can take focus (without showing an outline) so screen readers and Tab follow along
  grid.flat().forEach((panel) => panel.setAttribute('tabindex', '-1'));

  // ---------- Navigation bar: dots (where you are) and arrows (where you can go) ----------
  const navbar = document.querySelector('.navbar');
  navbar.insertAdjacentHTML('beforeend', `
    <div class="dots" aria-hidden="true">
      ${grid.map((panels) => `<span class="dots__col">${panels.map(() => '<i></i>').join('')}</span>`).join('')}
    </div>
    <div class="arrows is-hint">
      <button class="arrow arrow--up" data-dir="up" aria-label="Up">↑</button>
      <button class="arrow arrow--left" data-dir="left" aria-label="Previous column">←</button>
      <button class="arrow arrow--down" data-dir="down" aria-label="Down">↓</button>
      <button class="arrow arrow--right" data-dir="right" aria-label="Next column">→</button>
    </div>
    <p class="sr-only" aria-live="polite" id="cube-status"></p>`);

  const arrows = navbar.querySelector('.arrows');
  const dotCols = [...navbar.querySelectorAll('.dots__col')];
  const status = document.getElementById('cube-status');

  arrows.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dir]');
    if (btn) step(btn.dataset.dir);
  });

  // The arrows blink as a hint until the visitor's first move; after that
  // they show only the directions that lead somewhere
  let hinting = true;
  function stopHint() {
    if (!hinting) return;
    hinting = false;
    arrows.classList.remove('is-hint');
    updateArrows();
  }

  function updateArrows() {
    if (hinting) return;
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
    status.textContent = `${columns[col].dataset.title}: ${grid[col][level].dataset.level}`;
    history.replaceState(null, '', `#${columns[col].id}${level ? '/' + level : ''}`);
  }

  // ---------- Turning the cube ----------
  // The trick: put the next face on the side of the cube it should come from
  // (to the right, below…), then rotate the whole box 90° so that side faces us.
  // Afterwards everything is reset, with the new face simply flat in front.

  // Where the next face waits, and how the box turns to bring it to the front
  const SIDES = {
    right: { place: 'rotateY(90deg)', turn: 'rotateY(-90deg)' },
    left: { place: 'rotateY(-90deg)', turn: 'rotateY(90deg)' },
    down: { place: 'rotateX(-90deg)', turn: 'rotateX(90deg)' },
    up: { place: 'rotateX(90deg)', turn: 'rotateX(-90deg)' },
  };

  function go(col, level, dir) {
    if (state.busy) return;
    if (col === state.col && level === state.level) return;
    const from = grid[state.col][state.level];
    const to = grid[col][level];

    from.querySelectorAll('video').forEach((v) => v.pause()); // stop any video we leave
    to.scrollTop = 0; // always land at the top
    state.col = col;
    state.level = level;
    stopHint();
    updateUI();

    if (reducedMotion) {
      from.classList.remove('is-active');
      to.classList.add('is-active');
      to.focus({ preventScroll: true });
      return;
    }

    // Half the cube's width (or height): how far each face sits from its centre
    const horizontal = dir === 'left' || dir === 'right';
    const depth = (horizontal ? box.clientWidth : box.clientHeight) / 2;
    const { place, turn } = SIDES[dir];

    particles?.burst(box.getBoundingClientRect(), dir, DURATION);
    window.magneticField?.surge(); // the field swells as the cube moves through it

    from.style.transform = `translateZ(${depth}px)`;
    to.style.transform = `${place} translateZ(${depth}px)`;
    to.classList.add('is-active');

    box.style.transition = 'none';
    box.style.transform = `translateZ(${-depth}px)`;
    box.getBoundingClientRect(); // make the browser apply the start position before animating
    // Soft start, long gentle settle: the cube glides like something moving through water
    box.style.transition = `transform ${DURATION}ms cubic-bezier(0.5, 0, 0.15, 1)`;
    box.style.transform = `translateZ(${-depth}px) ${turn}`;

    root.classList.add('is-turning');
    to.focus({ preventScroll: true });
    state.busy = true;

    setTimeout(() => {
      box.style.transition = 'none';
      box.style.transform = '';
      from.style.transform = '';
      to.style.transform = '';
      from.classList.remove('is-active');
      root.classList.remove('is-turning');
      state.busy = false;
    }, DURATION);
  }

  function move(dir) {
    const { col, level } = state;
    if (dir === 'right' && col < columns.length - 1) go(col + 1, 0, 'right');
    if (dir === 'left' && col > 0) go(col - 1, 0, 'left');
    if (dir === 'down' && level < grid[col].length - 1) go(col, level + 1, 'down');
    if (dir === 'up' && level > 0) go(col, level - 1, 'up');
  }

  // A tall face (like the CV) scrolls first; only at its edge do we change level
  function canScroll(panel, dir) {
    if (dir === 'down') return panel.scrollTop + panel.clientHeight < panel.scrollHeight - 2;
    return panel.scrollTop > 2;
  }

  function step(dir) {
    stopHint();
    const panel = grid[state.col][state.level];
    if ((dir === 'up' || dir === 'down') && canScroll(panel, dir)) {
      panel.scrollBy({ top: (dir === 'down' ? 1 : -1) * panel.clientHeight * 0.8, behavior: 'smooth' });
    } else {
      move(dir);
    }
  }

  const menuOpen = () => root.classList.contains('menu-open');

  // ---------- Keyboard ----------
  const keyDirs = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

  window.addEventListener('keydown', (e) => {
    const dir = keyDirs[e.key];
    if (!dir) return;
    // Leave arrow keys alone while typing or using a slider
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (menuOpen()) return;
    e.preventDefault();
    step(dir);
  });

  // ---------- Swipe (phones and tablets) ----------
  let touch = null;

  cube.addEventListener('touchstart', (e) => {
    if (e.target.closest('input, textarea')) return;
    const panel = grid[state.col][state.level];
    touch = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      // Remember if the face was already at an edge when the swipe began,
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

  // ---------- Two-finger swipe on a laptop trackpad (and the mouse wheel) ----------
  // A trackpad swipe arrives as many small "wheel" events, and keeps coming for a
  // while after the fingers lift (momentum, getting weaker). One gesture moves the
  // cube at most once. A new gesture starts after a short pause, or when the deltas
  // suddenly get stronger again: that is a new swipe on top of the old momentum.
  let gesture = { last: 0, prev: 0, x: 0, y: 0, used: false, atTop: true, atBottom: true };

  window.addEventListener('wheel', (e) => {
    if (menuOpen() || e.ctrlKey) return; // ctrlKey = pinch to zoom
    if (e.target.closest?.('input, textarea, select')) return;

    // Some browsers (Firefox) count in lines or pages instead of pixels
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    const dx = e.deltaX * scale;
    const dy = e.deltaY * scale;
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    const now = performance.now();
    const panel = grid[state.col][state.level];

    const paused = now - gesture.last > 200;
    const newSwipe = gesture.used && !state.busy && size > gesture.prev * 2 && size > 12;
    if (paused || newSwipe) {
      gesture = { prev: 0, x: 0, y: 0, used: false, atTop: !canScroll(panel, 'up'), atBottom: !canScroll(panel, 'down') };
    }
    gesture.last = now;
    gesture.prev = size;

    // Sideways: always turns the cube (and stops the browser's "swipe back")
    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      if (gesture.used || state.busy) return;
      gesture.x += dx;
      if (Math.abs(gesture.x) > 30) {
        gesture.used = true;
        move(gesture.x > 0 ? 'right' : 'left');
      }
      return;
    }

    // Up and down: the face scrolls normally; past its edge, the cube turns
    if (gesture.used || state.busy) { e.preventDefault(); return; }
    const dir = dy > 0 ? 'down' : 'up';
    if (canScroll(panel, dir)) return;
    if ((dir === 'down' && !gesture.atBottom) || (dir === 'up' && !gesture.atTop)) return;
    e.preventDefault();
    gesture.y += dy;
    if (Math.abs(gesture.y) > 40) {
      gesture.used = true;
      move(dir);
    }
  }, { passive: false });

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

  // Other parts (the zoom-out menu) move the cube through this
  return {
    // targetId (optional): an element inside the face to scroll to and highlight,
    // used by the filter's "Read more" to land on the exact paragraph
    goTo(col, level = 0, targetId = null) {
      if (col === state.col) go(col, level, level >= state.level ? 'down' : 'up');
      else go(col, level, col > state.col ? 'right' : 'left');

      const target = targetId && document.getElementById(targetId);
      if (!target) return;
      const panel = grid[col][level];
      panel.scrollTop = Math.max(0, target.offsetTop - panel.clientHeight * 0.3);
      target.classList.add('is-highlighted');
      setTimeout(() => target.classList.remove('is-highlighted'), 2600);
    },
    get state() { return { col: state.col, level: state.level }; },
    columns,
    grid,
  };
}
