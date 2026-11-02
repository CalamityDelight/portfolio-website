// Earth's magnetic field: the header readout, its live intensity line, and the
// switch that turns the magnetic waves off (the background then becomes a still image).

const STORAGE_KEY = 'magnetic-effects';

// A small neon line that ripples as hard as the field: calm at Kp 0, wild at Kp 9
function startIntensityLine(canvas, getIntensity) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.width = 76 * dpr;
  const h = canvas.height = 20 * dpr;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last = 0;

  function draw(now) {
    if (now - last > 33) {
      last = now;
      const k = getIntensity();
      const t = still ? 0 : now / 1000;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#c6ff1a';
      ctx.lineWidth = 1.2 * dpr;
      ctx.shadowColor = 'rgba(198, 255, 26, 0.8)';
      ctx.shadowBlur = 4 * dpr;
      ctx.beginPath();
      for (let x = 0; x <= w; x += dpr) {
        const p = x / w;
        // Taller, tighter, faster waves as Kp rises; the ends taper to a point
        const amp = (0.12 + 0.75 * k) * (h / 2 - 2 * dpr) * Math.sin(Math.PI * p);
        const y = h / 2 + amp * Math.sin(p * (6 + 10 * k) - t * (2 + 6 * k));
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (!still) requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

export async function initField() {
  const slot = document.querySelector('.site-header__right');
  slot.insertAdjacentHTML('afterbegin', `
    <div class="kp">
      <span class="kp__text" aria-live="polite"><span class="kp__name">Earth's magnetic field</span> <span class="kp__value">· reading…</span></span>
      <canvas class="kp__line" aria-hidden="true"></canvas>
      <button class="kp__toggle" type="button" aria-pressed="true">Turn off effects</button>
    </div>`);

  const kp = slot.querySelector('.kp');
  const value = kp.querySelector('.kp__value');
  const toggle = kp.querySelector('.kp__toggle');
  const root = document.documentElement;
  let intensity = 0.2;

  // Waves on unless the visitor turned them off before, or asks their system for less motion
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let on = (localStorage.getItem(STORAGE_KEY) ?? (reducedMotion ? 'off' : 'on')) === 'on';

  function apply() {
    root.classList.toggle('field-off', !on); // shows the still image (field.css)
    window.magneticField.setEnabled(on);
    toggle.setAttribute('aria-pressed', String(on));
    toggle.textContent = on ? 'Turn off effects' : 'Turn on effects';
  }
  toggle.addEventListener('click', () => {
    on = !on;
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    apply();
  });

  startIntensityLine(kp.querySelector('.kp__line'), () => intensity);
  apply();

  try {
    const res = await fetch('/api/kp');
    if (!res.ok) throw new Error();
    const data = await res.json();
    value.textContent = `· Kp ${data.kp} · ${data.label}`;
    kp.title = `Planetary Kp index ${data.exact} (NOAA), measured ${new Date(data.time + 'Z').toUTCString()}`;
    intensity = Math.min(data.exact, 9) / 9; // Kp 0–9 becomes 0–1
    window.magneticField.setIntensity(intensity);
  } catch {
    value.textContent = '· no reading';
  }
}
