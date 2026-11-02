// Earth's magnetic field readout in the header, and the faint site pulse.
// The more disturbed the field (higher Kp), the stronger and faster the pulse.

const STORAGE_KEY = 'field-pulse';

// A tiny line graph of the last 24 hours, drawn as an SVG polyline
function sparkline(values) {
  const w = 44;
  const h = 14;
  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - (Math.min(v, 9) / 9) * h; // Kp 0 at the bottom, 9 at the top
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="kp__graph" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
            <polyline points="${points}" /></svg>`;
}

export async function initField() {
  const header = document.querySelector('.site-header__right');
  header.insertAdjacentHTML('afterbegin', `
    <div class="kp" aria-live="polite">
      <span class="kp__dot" aria-hidden="true"></span>
      <span class="kp__text">Earth's field · reading…</span>
      <button class="kp__toggle" type="button" aria-pressed="true" title="Turn the site pulse on or off">
        Pulse on
      </button>
    </div>`);

  const field = header.querySelector('.kp');
  const text = field.querySelector('.kp__text');
  const toggle = field.querySelector('.kp__toggle');
  const root = document.documentElement;

  // Pulse on unless the visitor turned it off before, or asks their system for less motion
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pulseOn = (localStorage.getItem(STORAGE_KEY) ?? (reducedMotion ? 'off' : 'on')) === 'on';

  function applyPulse() {
    root.classList.toggle('pulse-on', pulseOn);
    toggle.setAttribute('aria-pressed', String(pulseOn));
    toggle.textContent = pulseOn ? 'Pulse on' : 'Pulse off';
  }
  toggle.addEventListener('click', () => {
    pulseOn = !pulseOn;
    localStorage.setItem(STORAGE_KEY, pulseOn ? 'on' : 'off');
    applyPulse();
  });

  try {
    const res = await fetch('/api/kp');
    if (!res.ok) throw new Error();
    const data = await res.json();

    text.innerHTML = `<span class="kp__name">Earth's field · </span>Kp ${data.kp} · ${data.label} ${sparkline(data.history)}`;
    field.title = `Planetary Kp index ${data.exact} (NOAA), measured ${new Date(data.time + 'Z').toUTCString()}`;

    // 0 = barely visible, 1 = strongest. Kp 0 still gets a faint pulse.
    const strength = 0.2 + (Math.min(data.kp, 9) / 9) * 0.8;
    root.style.setProperty('--pulse-strength', strength.toFixed(2));
    root.style.setProperty('--pulse-speed', `${(7 - strength * 4).toFixed(1)}s`); // 6.2s calm, 3s storm
    root.dataset.field = data.label;
    applyPulse();
  } catch {
    text.textContent = "Earth's field · no reading";
    toggle.hidden = true;
  }
}
