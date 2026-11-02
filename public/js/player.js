// Custom video player: the browser's own controls look different in every
// browser, so we hide them and draw a few clean controls that match the site.

function formatTime(seconds) {
  if (!isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function setupPlayer(player) {
  const video = player.querySelector('video');
  if (!video) return;

  player.insertAdjacentHTML('beforeend', `
    <button class="player__big" type="button" aria-label="Play video">
      <span aria-hidden="true">▶</span>
    </button>
    <div class="player__bar">
      <button class="player__toggle" type="button" aria-label="Play">▶</button>
      <input class="player__seek" type="range" min="0" max="1000" value="0" aria-label="Seek">
      <span class="player__time">0:00</span>
      <button class="player__mute" type="button" aria-label="Mute">Sound</button>
      <button class="player__full" type="button" aria-label="Full screen">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
          <path d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4" />
        </svg>
      </button>
    </div>`);

  const big = player.querySelector('.player__big');
  const toggle = player.querySelector('.player__toggle');
  const seek = player.querySelector('.player__seek');
  const time = player.querySelector('.player__time');
  const mute = player.querySelector('.player__mute');
  const full = player.querySelector('.player__full');

  const playPause = () => (video.paused ? video.play() : video.pause());

  big.addEventListener('click', playPause);
  toggle.addEventListener('click', playPause);
  video.addEventListener('click', playPause);

  // Keep the buttons in step with the video, whatever started or stopped it
  video.addEventListener('play', () => {
    player.classList.add('is-playing');
    toggle.textContent = '❚❚';
    toggle.setAttribute('aria-label', 'Pause');
  });
  video.addEventListener('pause', () => {
    player.classList.remove('is-playing');
    toggle.textContent = '▶';
    toggle.setAttribute('aria-label', 'Play');
  });

  // The seek slider runs 0–1000 so it moves smoothly on long videos too
  video.addEventListener('timeupdate', () => {
    seek.value = (video.currentTime / video.duration) * 1000 || 0;
    seek.style.setProperty('--progress', `${seek.value / 10}%`);
    time.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  });
  seek.addEventListener('input', () => {
    video.currentTime = (seek.value / 1000) * video.duration;
  });

  mute.addEventListener('click', () => {
    video.muted = !video.muted;
    mute.textContent = video.muted ? 'Muted' : 'Sound';
    mute.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
  });

  full.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (player.requestFullscreen) player.requestFullscreen();
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iPhone
  });
}
