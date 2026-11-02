// Purple fibre texture, drawn once onto a canvas behind the site.
// Each fibre is a thin line that follows a "flow field": at every point
// the field gives a direction, so neighbouring lines bend together like
// smoke or magnetic field lines. In Part 3 the Kp pulse animates this canvas.

(function () {
  const canvas = document.getElementById('fibres');
  const ctx = canvas.getContext('2d');

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

  // Where fibres gather (in 0–1 screen units), echoing the clouds in the reference
  const clouds = [
    { x: 0.16, y: 0.2, r: 0.17 },
    { x: 0.8, y: 0.6, r: 0.15 },
    { x: 0.42, y: 0.95, r: 0.12 },
  ];

  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const random = seededRandom(7);
    const unit = Math.max(w, h);                 // keeps the swirls the same size on any screen
    const count = Math.min(2200, Math.round((w * h) / 700));

    // 'lighter' adds overlapping lines together, which gives the soft glow
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (let i = 0; i < count; i++) {
      // Start near a cloud centre, spread out with a rough bell curve
      const c = clouds[Math.floor(random() * clouds.length)];
      const spread = (random() + random() + random() - 1.5) * c.r;
      const spread2 = (random() + random() + random() - 1.5) * c.r;
      let x = (c.x + spread) * w;
      let y = (c.y + spread2) * h;

      const bright = random() < 0.06;           // a few brighter strands
      ctx.strokeStyle = bright
        ? 'rgba(196, 168, 255, 0.35)'
        : `rgba(123, 77, 255, ${0.06 + random() * 0.12})`;
      ctx.lineWidth = bright ? 0.9 : 0.4 + random() * 0.5;

      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 80 + random() * 160;
      for (let s = 0; s < steps; s++) {
        const a = flowAngle(x / unit, y / unit);
        x += Math.cos(a) * 2.2;
        y += Math.sin(a) * 2.2;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Darken the edges so text in the middle stays readable
    ctx.globalCompositeOperation = 'source-over';
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
    vignette.addColorStop(0, 'rgba(10, 6, 17, 0)');
    vignette.addColorStop(1, 'rgba(10, 6, 17, 0.7)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  // Redraw after resizing stops, not on every resize event
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 200);
  });

  draw();
})();
