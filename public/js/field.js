// Earth's magnetic field: the header readout and its tiny pulsing circle.
// The circle pulses faster as the field gets more disturbed (Kp 0–9).
// The same Kp value also makes the background vapour flow a little faster.

export async function initField() {
  const slot = document.querySelector('.site-header__right');
  slot.insertAdjacentHTML('afterbegin', `
    <div class="kp">
      <span class="kp__orb" aria-hidden="true"></span>
      <span class="kp__text" aria-live="polite"><span class="kp__name">Earth's magnetic field</span> <span class="kp__value">· reading…</span></span>
    </div>`);

  const kp = slot.querySelector('.kp');
  const value = kp.querySelector('.kp__value');
  const root = document.documentElement;

  // The background moves, unless the visitor asks their system for less motion
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.magneticField.setEnabled(!reducedMotion);

  try {
    const res = await fetch('/api/kp');
    if (!res.ok) throw new Error();
    const data = await res.json();
    value.textContent = `· Kp ${data.kp} · ${data.label}`;
    kp.title = `Planetary Kp index ${data.exact} (NOAA), measured ${new Date(data.time + 'Z').toUTCString()}`;

    const intensity = Math.min(data.exact, 9) / 9; // Kp 0–9 becomes 0–1
    window.magneticField.setIntensity(intensity);
    // Calm: a slow pulse (2.4 s). Storm: quick (0.6 s). Used by field.css.
    root.style.setProperty('--pulse-speed', `${(2.4 - 1.8 * intensity).toFixed(2)}s`);
  } catch {
    value.textContent = '· no reading';
  }
}
