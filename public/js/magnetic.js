// The magnetic field: the living background inside the cube.
//
// Layer 1: a still purple fibre texture, drawn once, for depth.
// Layer 2: smoke. Thousands of tiny particles drift through a "flow field" (at every
//          point the field gives a direction, and the field slowly changes over time).
//          Each frame they move a little and leave a faint purple line; older lines
//          fade, so together they draw soft, moving wisps like magnetic smoke.
//          Earth's real magnetic field (Kp 0–9, set by field.js) decides how many
//          particles there are, how fast they move and how turbulent the flow is.
//          A few particles carry a bright turquoise sheen.
// Layer 3: bioluminescence. The smoke reacts to the visitor like plankton in dark
//          water: the cursor parts it and charges it turquoise, sparks trail behind,
//          a click sends out ripples, and a cube turn makes the field surge.
// Pages with <canvas data-mode="still"> (login, studio) only get the still texture.

(function () {
  const canvas = document.getElementById('fibres');
  const ctx = canvas.getContext('2d');
  const texture = document.createElement('canvas'); // layer 1, kept off-screen
  const smoke = document.createElement('canvas');   // layer 2: trails build up here
  const smokeCtx = smoke.getContext('2d');
  const vignette = document.createElement('canvas'); // darkens the edges to near black
  const still = canvas.dataset.mode === 'still';
  const TURQUOISE = '94, 240, 196';

  let width = 0;
  let height = 0;
  let dpr = 1;
  let intensity = 0.2;  // 0 = Kp 0 (calm) … 1 = Kp 9 (extreme storm)
  let enabled = false;  // field.js switches the animation on
  let surge = 0;        // extra motion right after the cube turns, fading out

  const pointer = { x: -9999, y: -9999, energy: 0 }; // energy: how hard the water is stirred (0–1)
  let particles = [];
  let sparks = [];
  let ripples = [];

  // Small seeded random generator, so the still texture looks the same on every visit
  function seededRandom(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Where the smoke gathers (0–1 screen units), echoing the clouds in the reference.
  // The clouds drift slowly, so the wisps wander across the screen over time.
  const clouds = [
    { x: 0.18, y: 0.4, r: 0.13 },
    { x: 0.8, y: 0.72, r: 0.12 },
    { x: 0.5, y: 0.98, r: 0.1 },
    { x: 0.72, y: 0.1, r: 0.09 },
  ];

  // ---------- Layer 1: still texture ----------
  function drawTexture() {
    texture.width = width * dpr;
    texture.height = height * dpr;
    const t = texture.getContext('2d');
    t.setTransform(dpr, 0, 0, dpr, 0, 0);
    const random = seededRandom(7);
    const unit = Math.max(width, height);
    const angle = (x, y) => (Math.sin(x * 5.5) + Math.cos(y * 6.5) + Math.sin((x - y) * 3.1)) * Math.PI * 0.6;

    t.globalCompositeOperation = 'lighter';
    t.lineCap = 'round';
    const count = Math.min(1600, Math.round((width * height) / 900));
    for (let i = 0; i < count; i++) {
      const c = clouds[Math.floor(random() * clouds.length)];
      let x = (c.x + (random() + random() + random() - 1.5) * c.r) * width;
      let y = (c.y + (random() + random() + random() - 1.5) * c.r) * height;
      t.strokeStyle = `rgba(96, 56, 196, ${0.03 + random() * 0.06})`;
      t.lineWidth = 0.4 + random() * 0.5;
      t.beginPath();
      t.moveTo(x, y);
      const steps = 80 + random() * 160;
      for (let s = 0; s < steps; s++) {
        const a = angle(x / unit, y / unit);
        x += Math.cos(a) * 2.2;
        y += Math.sin(a) * 2.2;
        t.lineTo(x, y);
      }
      t.stroke();
    }
  }

  function drawVignette() {
    vignette.width = width * dpr;
    vignette.height = height * dpr;
    const v = vignette.getContext('2d');
    v.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = v.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.25, width / 2, height / 2, Math.max(width, height) * 0.72);
    g.addColorStop(0, 'rgba(7, 4, 11, 0)');
    g.addColorStop(1, 'rgba(7, 4, 11, 0.85)');
    v.fillStyle = g;
    v.fillRect(0, 0, width, height);
  }

  // ---------- Layer 2: smoke ----------

  // The flow direction at (x, y) at a moment in time. Overlapping sine waves that
  // shift with time give slowly changing swirls; more Kp = tighter, busier swirls.
  function flow(x, y, time) {
    const f = 0.0026 * (1 + 0.8 * intensity);
    return (
      Math.sin(x * f + time * 0.11) +
      Math.cos(y * f * 1.3 - time * 0.09) +
      Math.sin((x + y) * f * 0.6 + time * 0.05)
    ) * Math.PI * 0.75 - Math.PI / 2; // the - PI/2 leans the smoke upwards, like rising wisps
  }

  // A new particle, born somewhere in one of the clouds
  function spawn(p, time) {
    const c = clouds[Math.floor(Math.random() * clouds.length)];
    const drift = Math.sin(time * 0.05 + c.x * 10) * 0.05; // clouds wander slowly
    const spread = () => (Math.random() + Math.random() + Math.random() - 1.5) * c.r;
    p.x = (c.x + drift + spread()) * width;
    p.y = (c.y + spread()) * height;
    p.life = 120 + Math.random() * 380;   // in frames
    p.sheen = Math.random() < 0.025;      // about 1 in 40 carries the turquoise sheen
    p.charge = 0;                         // turquoise glow from being touched
    return p;
  }

  function stepSmoke(time) {
    const k = intensity;
    const target = Math.round((700 + 1500 * k) * Math.min(1, (width * height) / (1440 * 900)));
    while (particles.length < target) particles.push(spawn({}, time));
    if (particles.length > target) particles.length = target;

    const speed = (0.45 + 1.5 * k) * (1 + surge);

    // Fade the old trails a little, instead of wiping them: this is what makes the wisps
    smokeCtx.globalCompositeOperation = 'destination-out';
    smokeCtx.fillStyle = `rgba(0, 0, 0, ${0.03 + 0.02 * k})`;
    smokeCtx.fillRect(0, 0, width, height);
    smokeCtx.globalCompositeOperation = 'lighter';
    smokeCtx.lineCap = 'round';

    // All purple segments go in one path and all turquoise in another: drawing
    // two big paths per frame is far faster than thousands of small ones
    const purple = new Path2D();
    const glow = new Path2D();
    const r2 = 150 * 150;

    for (const p of particles) {
      const a = flow(p.x, p.y, time);
      let vx = Math.cos(a) * speed;
      let vy = Math.sin(a) * speed;

      // The pointer parts the smoke and charges it with turquoise light
      if (pointer.energy > 0.01) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2 * 4) {
          const falloff = Math.exp(-d2 / r2) * pointer.energy;
          const d = Math.sqrt(d2) || 1;
          vx += (dx / d) * 3.5 * falloff;
          vy += (dy / d) * 3.5 * falloff;
          p.charge = Math.min(1, p.charge + falloff * 0.5);
        }
      }

      const x0 = p.x;
      const y0 = p.y;
      p.x += vx;
      p.y += vy;
      const path = p.sheen || p.charge > 0.15 ? glow : purple;
      path.moveTo(x0, y0);
      path.lineTo(p.x, p.y);

      p.charge *= 0.985;
      if (--p.life <= 0 || p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) spawn(p, time);
    }

    smokeCtx.lineWidth = 0.9;
    smokeCtx.strokeStyle = `rgba(165, 95, 255, ${0.26 + 0.1 * k})`;
    smokeCtx.stroke(purple);
    smokeCtx.lineWidth = 1;
    smokeCtx.strokeStyle = `rgba(${TURQUOISE}, ${0.3 + 0.15 * k})`;
    smokeCtx.stroke(glow);
  }

  // ---------- Layer 3: bioluminescence ----------

  // One glowing dot, drawn once and stamped for every spark
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 32;
  (() => {
    const s = sprite.getContext('2d');
    const g = s.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(225, 255, 242, 1)');
    g.addColorStop(0.2, `rgba(${TURQUOISE}, 0.8)`);
    g.addColorStop(0.5, `rgba(${TURQUOISE}, 0.15)`);
    g.addColorStop(1, `rgba(${TURQUOISE}, 0)`);
    s.fillStyle = g;
    s.fillRect(0, 0, 32, 32);
  })();

  function drawBioluminescence() {
    if (pointer.energy > 0.01) {
      const r = 160 + 100 * pointer.energy;
      const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, r);
      g.addColorStop(0, `rgba(${TURQUOISE}, ${(0.09 * pointer.energy).toFixed(3)})`);
      g.addColorStop(1, `rgba(${TURQUOISE}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(pointer.x - r, pointer.y - r, r * 2, r * 2);
    }

    // Sparks drift and wander slowly, then fade
    sparks = sparks.filter((s) => (s.life -= 1) > 0);
    for (const s of sparks) {
      s.angle += (Math.random() - 0.5) * 0.3;
      s.x += Math.cos(s.angle) * s.speed;
      s.y += Math.sin(s.angle) * s.speed - 0.15;
      s.speed *= 0.985;
      ctx.globalAlpha = Math.min(1, (s.life / s.max) * 1.5) * (0.6 + 0.4 * Math.random());
      const size = s.size * 9;
      ctx.drawImage(sprite, s.x - size / 2, s.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;

    // Rings spreading out from a click
    ripples = ripples.filter((r) => (r.life -= 1) > 0);
    ctx.lineWidth = 1;
    for (const r of ripples) {
      const p = 1 - r.life / r.max; // 0 → 1 over the ripple's life
      ctx.strokeStyle = `rgba(${TURQUOISE}, ${(0.45 * (1 - p)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 8 + p * r.size, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---------- Putting the layers together ----------
  function render(now = 0) {
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = enabled ? 0.55 : 1; // the still texture sits quietly under the smoke
    ctx.drawImage(texture, 0, 0, width, height);
    ctx.globalAlpha = 1;
    if (enabled) {
      stepSmoke(now / 1000);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(smoke, 0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(vignette, 0, 0, width, height);
    if (!enabled) return;
    ctx.globalCompositeOperation = 'lighter';
    drawBioluminescence(); // on top of the vignette, so the touch glows even near the edges
    ctx.globalCompositeOperation = 'source-over';

    pointer.energy *= 0.965; // the water calms down when the pointer rests
    surge *= 0.97;
  }

  function loop(now) {
    if (!enabled) return;
    render(now);
    requestAnimationFrame(loop);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    for (const c of [canvas, smoke]) {
      c.width = width * dpr;
      c.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    smokeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    particles = [];
    drawTexture();
    drawVignette();
    render(performance.now());
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  });
  resize();

  // ---------- The visitor touching the water ----------
  if (!still) {
    window.addEventListener('pointermove', (e) => {
      const moved = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
      const jumped = moved > 300; // first move, or the pointer re-entered the window
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (!enabled || jumped) return;
      pointer.energy = Math.min(1, pointer.energy + moved / 120);
      // Faster strokes stir up more sparks
      const count = Math.min(4, Math.floor(moved / 12));
      for (let i = 0; i < count; i++) {
        const life = 50 + Math.random() * 90; // in frames
        sparks.push({
          x: e.clientX + (Math.random() - 0.5) * 24,
          y: e.clientY + (Math.random() - 0.5) * 24,
          angle: Math.random() * Math.PI * 2,
          speed: 0.3 + Math.random() * 1.1,
          size: 0.4 + Math.random() * 1.1,
          life,
          max: life,
        });
      }
      if (sparks.length > 300) sparks.splice(0, sparks.length - 300);
    }, { passive: true });

    window.addEventListener('pointerdown', (e) => {
      if (!enabled) return;
      ripples.push({ x: e.clientX, y: e.clientY, size: 200, life: 80, max: 80 });
      ripples.push({ x: e.clientX, y: e.clientY, size: 120, life: 60, max: 60 });
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.energy = 1;
    }, { passive: true });
  }

  // field.js and cube.js control the field through these functions
  window.magneticField = {
    setIntensity(value) {
      intensity = Math.max(0, Math.min(1, value));
    },
    setEnabled(on) {
      if (still) return;
      const wasOn = enabled;
      enabled = on;
      if (on && !wasOn) requestAnimationFrame(loop);
      if (!on) render();
    },
    // The cube turned: the smoke swirls faster for a moment, stirred by the moving cube
    surge() {
      surge = 1.4;
    },
  };
})();
