// The magnetic field behind the site.
// Layer 1: a purple fibre texture, drawn once (fibres follow a "flow field",
//          so neighbouring lines bend together like smoke or field lines).
// Layer 2: dark purple magnetic waves, animated every frame. How tall, fast and
//          bright they are follows Earth's real magnetic field (Kp 0–9, set by field.js).
// Pages with <canvas data-mode="still"> (login, studio) only get the still texture.

(function () {
  const canvas = document.getElementById('fibres');
  const ctx = canvas.getContext('2d');
  const texture = document.createElement('canvas'); // the still layer, kept off-screen
  const still = canvas.dataset.mode === 'still';

  let width = 0;
  let height = 0;
  let intensity = 0.2;  // 0 = Kp 0 (calm) … 1 = Kp 9 (extreme storm)
  let enabled = false;  // field.js switches the animation on
  let lastFrame = 0;

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

      const bright = random() < 0.05;
      t.strokeStyle = bright ? 'rgba(170, 130, 255, 0.28)' : `rgba(110, 64, 230, ${0.05 + random() * 0.1})`;
      t.lineWidth = bright ? 0.9 : 0.4 + random() * 0.5;

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
    vignette.addColorStop(0, 'rgba(7, 4, 13, 0)');
    vignette.addColorStop(1, 'rgba(7, 4, 13, 0.75)');
    t.fillStyle = vignette;
    t.fillRect(0, 0, width, height);
  }

  // Magnetic waves: lines across the screen that ripple like field lines.
  // More intensity = more lines, taller waves, faster motion, brighter purple.
  function drawWaves(time) {
    const k = intensity;
    const lines = Math.round(14 + 26 * k);
    const amplitude = 18 + 64 * k;
    const speed = 0.25 + 1.6 * k;
    const baseAlpha = 0.12 + 0.16 * k;

    ctx.lineWidth = 1;
    for (let i = 0; i < lines; i++) {
      const y0 = (height * (i + 0.5)) / lines;
      const phase = i * 0.55;
      // Each line brightens and fades slowly, so a glow seems to travel through the field
      const alpha = baseAlpha * (0.55 + 0.45 * Math.sin(time * speed * 0.7 + phase));
      ctx.strokeStyle = `rgba(118, 70, 235, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      for (let x = -20; x <= width + 20; x += 14) {
        const y = y0
          + amplitude * Math.sin(x * 0.004 + time * speed + phase)
          + amplitude * 0.45 * Math.sin(x * 0.011 - time * speed * 0.8 + phase * 1.7);
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
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
    ctx.globalCompositeOperation = 'source-over';
  }

  // About 30 frames per second is smooth enough for slow waves and saves battery
  function loop(now) {
    if (!enabled) return;
    if (now - lastFrame > 33) {
      render(now);
      lastFrame = now;
    }
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

  // field.js controls the waves through these two functions
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
  };
})();
