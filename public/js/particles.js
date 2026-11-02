// Glowing particles thrown off the cube's edges as it turns, like light stirred up
// in dark water. Each particle has a position, a speed, a direction and a lifetime;
// every frame it drifts, its direction wanders a little (so the paths curve and flow),
// and it fades. Instead of wiping the canvas, each frame only dims the last one,
// which leaves soft trails behind the particles. The loop runs while anything is visible.

const COLOUR = '94, 240, 196';

// One soft glowing dot, drawn once and then stamped for every particle (much faster than shadows)
function makeSprite() {
  const size = 32;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  const ctx = sprite.getContext('2d');
  const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  glow.addColorStop(0, 'rgba(225, 255, 242, 1)'); // a mint-white core
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
  let fadeFrames = 0; // frames left to let the trails fade after the last particle dies
  function frame(now) {
    const dt = Math.min((now - last) / 16.7, 3); // 1 = one frame at 60 fps
    last = now;

    // Dim what was drawn before instead of clearing it: this is what makes the trails
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) {
      p.turn += (Math.random() - 0.5) * 0.04 * dt;  // the path slowly bends one way or the other
      const cos = Math.cos(p.turn * dt);
      const sin = Math.sin(p.turn * dt);
      [p.vx, p.vy] = [p.vx * cos - p.vy * sin, p.vx * sin + p.vy * cos];
      p.vx *= 0.975 ** dt; // the water slows it down
      p.vy *= 0.975 ** dt;
      p.vy -= 0.015 * dt;  // and it drifts up a little
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.4);
      const s = p.size * 8;
      ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    if (particles.length) fadeFrames = 40;
    if (particles.length || fadeFrames-- > 0) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, width, height);
      running = false;
    }
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
      for (let i = 0; i < 3; i++) {
        const edge = Math.random() < 0.5 ? 0 : 1;
        const along = Math.random();
        const speed = 1.5 + Math.random() * 4.5;
        const p = horizontal
          ? { x: edge ? rect.right : rect.left, y: rect.top + along * rect.height, vx: sign * speed, vy: (Math.random() - 0.5) * 1.5 }
          : { x: rect.left + along * rect.width, y: edge ? rect.bottom : rect.top, vx: (Math.random() - 0.5) * 1.5, vy: sign * speed };
        p.max = p.life = 60 + Math.random() * 60; // lifetime in frames
        p.size = 0.5 + Math.random() * 1.5;
        p.turn = (Math.random() - 0.5) * 0.06;     // how much its path curves
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
