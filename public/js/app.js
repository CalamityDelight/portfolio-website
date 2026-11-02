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

const works = await loadWorks();
renderWorks(works, cube);
cube.querySelectorAll('.player').forEach(setupPlayer);
initComments(cube);

const nav = initCube(cube);
initMenu(nav);
initAccount();
