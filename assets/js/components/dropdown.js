/** @type {HTMLElement | null} */
let openRoot = null;

let ready = false;

/**
 * @param {HTMLElement | null} root
 */
function setOpen(root, open) {
  if (!root) return;
  const trigger = root.querySelector('[data-dropdown-trigger]');
  const menu = root.querySelector('[data-dropdown-menu]');
  root.dataset.open = open ? 'true' : 'false';
  trigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (menu) menu.hidden = !open;
  openRoot = open ? root : null;
}

function closeOpen() {
  if (!openRoot) return;
  const trigger = openRoot.querySelector('[data-dropdown-trigger]');
  setOpen(openRoot, false);
  return trigger;
}

/**
 * Closes any open menu. Safe to call more than once.
 */
export function closeDropdowns() {
  closeOpen();
}

/**
 * Document-level dropdown behavior for every [data-dropdown] block.
 */
export function initDropdowns() {
  if (ready) return;
  ready = true;

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const trigger = target.closest('[data-dropdown-trigger]');
    if (trigger) {
      const root = trigger.closest('[data-dropdown]');
      const willOpen = trigger.getAttribute('aria-expanded') !== 'true';
      closeOpen();
      if (willOpen) setOpen(root, true);
      return;
    }

    if (target.closest('[role="menuitem"]')) {
      closeOpen();
      return;
    }

    if (!target.closest('[data-dropdown-menu]')) closeOpen();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openRoot) {
      const trigger = closeOpen();
      if (trigger instanceof HTMLElement) trigger.focus();
      return;
    }

    if (!openRoot) return;

    const trigger = openRoot.querySelector('[data-dropdown-trigger]');
    if (document.activeElement === trigger && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const menuItems = [...openRoot.querySelectorAll('[role="menuitem"]')];
      const targetItem = event.key === 'ArrowUp' ? menuItems[menuItems.length - 1] : menuItems[0];
      if (targetItem instanceof HTMLElement) targetItem.focus();
      return;
    }

    const items = [...openRoot.querySelectorAll('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement);
    if (index < 0) return;

    let next = index;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;

    event.preventDefault();
    const item = items[next];
    if (item instanceof HTMLElement) item.focus();
  });
}
