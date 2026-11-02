// Neon particles thrown off the cube's edges as it turns, then fading out.
// Each particle is a dot with a position, a speed and a lifetime; every frame
// it moves, slows down a little and fades. The loop only runs while dots are alive.

const COLOUR = '198, 255, 26';

// One soft glowing dot, drawn once and then stamped for every particle (much faster than shadows)
function makeSprite() {
  const size = 32;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  const ctx = sprite.getContext('2d');
  const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  glow.addColorStop(0, `rgba(${COLOUR}, 1)`);
  glow.addColorStop(0.18, `rgba(${COLOUR}, 0.9)`);
  glow.addColorStop(0.45, `rgba(${COLOUR}, 0.18)`);
  glow.addColorStop(1, `rgba(${COLOUR}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  return sprite;
}

export function createParticles(canvas) {
  const ctx = canvas.getContext('2d');
  const sprite = makeSprite();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let particles = [];
  let running = false;
  let width = 0;
  let height = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  let last = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 16.7, 3); // 1 = one frame at 60 fps
    last = now;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) {
      p.vx *= 0.965 ** dt; // air resistance
      p.vy = p.vy * 0.965 ** dt - 0.02 * dt; // and a slight lift, like sparks
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.min(1, p.life / p.max * 1.6);
      const s = p.size * 8;
      ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    if (particles.length) requestAnimationFrame(frame);
    else running = false;
  }

  // rect: where the cube is on screen. dir: which way the visitor moved.
  // Particles leave from the two edges that lead the turn and fly the way the cube spins.
  function burst(rect, dir, duration = 950) {
    if (reducedMotion) return;
    const horizontal = dir === 'left' || dir === 'right';
    const sign = dir === 'right' || dir === 'down' ? -1 : 1;
    const start = performance.now();

    // Spawn a few each frame during the first half of the turn
    function spawn(now) {
      for (let i = 0; i < 4; i++) {
        const edge = Math.random() < 0.5 ? 0 : 1;
        const along = Math.random();
        const speed = 2 + Math.random() * 6;
        const p = horizontal
          ? { x: edge ? rect.right : rect.left, y: rect.top + along * rect.height, vx: sign * speed, vy: (Math.random() - 0.5) * 1.5 }
          : { x: rect.left + along * rect.width, y: edge ? rect.bottom : rect.top, vx: (Math.random() - 0.5) * 1.5, vy: sign * speed };
        p.max = p.life = 35 + Math.random() * 45; // lifetime in frames
        p.size = 0.6 + Math.random() * 1.6;
        particles.push(p);
      }
      if (now - start < duration * 0.55) requestAnimationFrame(spawn);
    }
    requestAnimationFrame(spawn);

    if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }

  return { burst };
}
