// The magnetic field: the living background inside the cube.
// Layer 1: a purple fibre texture, drawn once (fibres follow a "flow field",
//          so neighbouring lines bend together like smoke or field lines).
// Layer 2: dark purple field lines and turquoise currents, animated every frame.
//          How tall, fast and bright they are follows Earth's real magnetic field
//          (Kp 0–9, set by field.js).
// Layer 3: bioluminescence. The field reacts to the visitor like plankton in dark
//          water: the cursor lights it up and pushes the lines aside, sparks trail
//          behind it, a click sends out a ripple, and a cube turn makes it surge.
// Pages with <canvas data-mode="still"> (login, studio) only get the still texture.

(function () {
  const canvas = document.getElementById('fibres');
  const ctx = canvas.getContext('2d');
  const texture = document.createElement('canvas'); // the still layer, kept off-screen
  const still = canvas.dataset.mode === 'still';
  const TURQUOISE = '94, 240, 196';

  let width = 0;
  let height = 0;
  let intensity = 0.2;  // 0 = Kp 0 (calm) … 1 = Kp 9 (extreme storm)
  let enabled = false;  // field.js switches the animation on
  let surge = 0;        // extra motion right after the cube turns, fading out

  // The visitor's pointer, and how much it is stirring the water right now (0–1)
  const pointer = { x: -9999, y: -9999, energy: 0 };
  let sparks = [];
  let ripples = [];

  // Small seeded random generator, so the texture looks the same on every visit
  function seededRandom(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Direction of the flow at (x, y). Overlapping sine waves give soft swirls.
  function flowAngle(x, y) {
    return (Math.sin(x * 5.5) + Math.cos(y * 6.5) + Math.sin((x - y) * 3.1)) * Math.PI * 0.6;
  }

  // Where fibres gather (in 0–1 screen units)
  const clouds = [
    { x: 0.12, y: 0.2, r: 0.17 },
    { x: 0.86, y: 0.62, r: 0.15 },
    { x: 0.42, y: 0.98, r: 0.12 },
  ];

  function drawTexture(dpr) {
    texture.width = width * dpr;
    texture.height = height * dpr;
    const t = texture.getContext('2d');
    t.setTransform(dpr, 0, 0, dpr, 0, 0);

    const random = seededRandom(7);
    const unit = Math.max(width, height);
    const count = Math.min(2200, Math.round((width * height) / 700));

    // 'lighter' adds overlapping lines together, which gives the soft glow
    t.globalCompositeOperation = 'lighter';
    t.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const c = clouds[Math.floor(random() * clouds.length)];
      let x = (c.x + (random() + random() + random() - 1.5) * c.r) * width;
      let y = (c.y + (random() + random() + random() - 1.5) * c.r) * height;

      const glint = random();
      t.strokeStyle = glint < 0.04 ? `rgba(${TURQUOISE}, 0.16)`       // a few turquoise strands
        : glint < 0.08 ? 'rgba(170, 130, 255, 0.22)'
        : `rgba(104, 62, 210, ${0.05 + random() * 0.09})`;
      t.lineWidth = glint < 0.08 ? 0.9 : 0.4 + random() * 0.5;

      t.beginPath();
      t.moveTo(x, y);
      const steps = 80 + random() * 160;
      for (let s = 0; s < steps; s++) {
        const a = flowAngle(x / unit, y / unit);
        x += Math.cos(a) * 2.2;
        y += Math.sin(a) * 2.2;
        t.lineTo(x, y);
      }
      t.stroke();
    }

    // Darken the edges into near-black purple
    t.globalCompositeOperation = 'source-over';
    const vignette = t.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.75);
    vignette.addColorStop(0, 'rgba(11, 7, 17, 0)');
    vignette.addColorStop(1, 'rgba(11, 7, 17, 0.75)');
    t.fillStyle = vignette;
    t.fillRect(0, 0, width, height);
  }

  // One glowing dot, drawn once and stamped for every spark
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 32;
  (() => {
    const s = sprite.getContext('2d');
    const g = s.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(220, 255, 240, 1)');
    g.addColorStop(0.2, `rgba(${TURQUOISE}, 0.8)`);
    g.addColorStop(0.5, `rgba(${TURQUOISE}, 0.15)`);
    g.addColorStop(1, `rgba(${TURQUOISE}, 0)`);
    s.fillStyle = g;
    s.fillRect(0, 0, 32, 32);
  })();

  // How far the pointer pushes a point of a line away (water parting around a finger)
  function push(x, y) {
    if (pointer.energy < 0.01) return 0;
    const dx = x - pointer.x;
    const dy = y - pointer.y;
    const falloff = Math.exp(-(dx * dx + dy * dy) / (160 * 160));
    return Math.sign(dy || 1) * 46 * pointer.energy * falloff;
  }

  // Draws one wavy line across the screen
  function waveLine(y0, amplitude, frequency, speed, time, phase) {
    ctx.beginPath();
    for (let x = -20; x <= width + 20; x += 12) {
      let y = y0
        + amplitude * Math.sin(x * frequency + time * speed + phase)
        + amplitude * 0.45 * Math.sin(x * frequency * 2.7 - time * speed * 0.8 + phase * 1.7);
      y += push(x, y);
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Field lines (purple) and currents (turquoise). Stronger field = more, taller, faster, brighter.
  function drawWaves(time) {
    const k = intensity;
    const boost = 1 + surge;
    const speed = (0.25 + 1.6 * k) * (1 + surge * 0.6);

    // Purple field lines
    const lines = Math.round(14 + 26 * k);
    const amplitude = (18 + 64 * k) * boost;
    const purpleAlpha = 0.12 + 0.16 * k;
    ctx.lineWidth = 1;
    for (let i = 0; i < lines; i++) {
      const phase = i * 0.55;
      const alpha = purpleAlpha * (0.55 + 0.45 * Math.sin(time * speed * 0.7 + phase));
      ctx.strokeStyle = `rgba(118, 70, 235, ${alpha.toFixed(3)})`;
      waveLine((height * (i + 0.5)) / lines, amplitude, 0.004, speed, time, phase);
    }

    // Turquoise currents: fewer, longer and slower, drawn twice (wide and faint, then thin)
    // so they glow like bioluminescent streaks
    const currents = Math.round(4 + 6 * k);
    for (let i = 0; i < currents; i++) {
      const phase = i * 1.9 + 0.7;
      const y0 = height * (0.15 + 0.7 * ((i * 0.618) % 1));
      const glow = (0.05 + 0.1 * k) * (0.4 + 0.6 * Math.max(0, Math.sin(time * 0.35 + phase)));
      ctx.strokeStyle = `rgba(${TURQUOISE}, ${(glow * 0.35).toFixed(3)})`;
      ctx.lineWidth = 7;
      waveLine(y0, amplitude * 1.6, 0.0022, speed * 0.6, time, phase);
      ctx.strokeStyle = `rgba(${TURQUOISE}, ${glow.toFixed(3)})`;
      ctx.lineWidth = 1.2;
      waveLine(y0, amplitude * 1.6, 0.0022, speed * 0.6, time, phase);
    }
  }

  // The water lights up where it is touched
  function drawBioluminescence() {
    if (pointer.energy > 0.01) {
      const r = 180 + 120 * pointer.energy;
      const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, r);
      g.addColorStop(0, `rgba(${TURQUOISE}, ${(0.16 * pointer.energy).toFixed(3)})`);
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
      ctx.globalAlpha = Math.min(1, s.life / s.max * 1.5) * (0.7 + 0.3 * Math.random());
      const size = s.size * 10;
      ctx.drawImage(sprite, s.x - size / 2, s.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;

    // Rings spreading out from a click
    ripples = ripples.filter((r) => (r.life -= 1) > 0);
    ctx.lineWidth = 1.2;
    for (const r of ripples) {
      const p = 1 - r.life / r.max;               // 0 → 1 over the ripple's life
      ctx.strokeStyle = `rgba(${TURQUOISE}, ${(0.5 * (1 - p)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 10 + p * r.size, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function render(now = 0) {
    ctx.clearRect(0, 0, width, height);
    if (!enabled) {
      ctx.drawImage(texture, 0, 0, width, height);
      return;
    }
    const time = now / 1000;
    // The texture itself sways a few pixels, stronger in a disturbed field
    const sway = 3 + 10 * intensity;
    ctx.drawImage(texture, Math.sin(time * 0.3) * sway - sway, Math.cos(time * 0.23) * sway - sway, width + sway * 2, height + sway * 2);
    ctx.globalCompositeOperation = 'lighter';
    drawWaves(time);
    drawBioluminescence();
    ctx.globalCompositeOperation = 'source-over';

    pointer.energy *= 0.965;   // the water calms down when the pointer rests
    surge *= 0.97;
  }

  function loop(now) {
    if (!enabled) return;
    render(now);
    requestAnimationFrame(loop);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTexture(dpr);
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
      const speed = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
      const jumped = speed > 300; // first move, or the pointer re-entered the window
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (!enabled || jumped) return;
      pointer.energy = Math.min(1, pointer.energy + speed / 120);
      // Faster strokes stir up more sparks
      const count = Math.min(5, Math.floor(speed / 10));
      for (let i = 0; i < count; i++) {
        const life = 50 + Math.random() * 90; // in frames
        sparks.push({
          x: e.clientX + (Math.random() - 0.5) * 24,
          y: e.clientY + (Math.random() - 0.5) * 24,
          angle: Math.random() * Math.PI * 2,
          speed: 0.3 + Math.random() * 1.2,
          size: 0.4 + Math.random() * 1.2,
          life,
          max: life,
        });
      }
      if (sparks.length > 400) sparks.splice(0, sparks.length - 400);
    }, { passive: true });

    window.addEventListener('pointerdown', (e) => {
      if (!enabled) return;
      ripples.push({ x: e.clientX, y: e.clientY, size: 220, life: 80, max: 80 });
      ripples.push({ x: e.clientX, y: e.clientY, size: 140, life: 60, max: 60 });
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
    // The cube turned: the field swells for a moment, like water pushed by a moving body
    surge() {
      surge = 1.2;
    },
  };
})();
