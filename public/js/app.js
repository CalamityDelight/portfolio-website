// Entry point: load the works, build their columns, then wire up the parts.
import { loadWorks, renderWorks } from './works.js';
import { setupPlayer } from './player.js';
import { initCube } from './cube.js';
import { initMenu } from './menu.js';
import { initAccount } from './account.js';

const cube = document.getElementById('cube');

const works = await loadWorks();
renderWorks(works, cube);
cube.querySelectorAll('.player').forEach(setupPlayer);

const nav = initCube(cube);
initMenu(nav);
initAccount();
