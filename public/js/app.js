// Entry point: load the works, build their columns, then wire up the parts.
import { loadWorks, renderWorks } from './works.js';
import { setupPlayer } from './player.js';
import { initCube } from './cube.js';
import { initMenu } from './menu.js';
import { initAccount } from './account.js';
import { initComments } from './comments.js';
import { initField } from './field.js';

const cube = document.getElementById('cube');

// The field readout doesn't depend on the works, so it starts loading right away
initField();

let works = [];
let tags = [];
try {
  [works, tags] = await Promise.all([
    loadWorks(),
    fetch('/data/tags.json').then((res) => res.json()), // the fixed tag list for the filter
  ]);
} catch {
  // Database or network down: Home and the CV still work, with a short note on the intro
  document.querySelector('.intro__hint').insertAdjacentHTML('beforeend',
    '<p class="label">The works could not be loaded right now. Please try again later.</p>');
}
renderWorks(works, cube);
cube.querySelectorAll('.player').forEach(setupPlayer);
initComments(cube);

const nav = initCube(cube);
initMenu(nav, works, tags);
initAccount();
