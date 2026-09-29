import { hydrateIcons } from './core/icons.js';
import { initTheme } from './core/theme.js';
import { initDropdowns } from './components/dropdown.js';
import { mountShell } from './components/shell.js';

initTheme();
mountShell();
initDropdowns();
hydrateIcons();
