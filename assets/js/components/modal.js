import { icon } from '../core/icons.js';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** @type {HTMLElement | null} */
let backdrop = null;

/** @type {HTMLElement | null} */
let previouslyFocused = null;

/**
 * @param {KeyboardEvent} event
 */
function trapFocus(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal();
    return;
  }

  if (event.key !== 'Tab' || !backdrop) return;

  const dialog = backdrop.querySelector('[role="dialog"]');
  if (!dialog) return;

  const nodes = [...dialog.querySelectorAll(FOCUSABLE)];
  if (!nodes.length) return;

  const first = nodes[0];
  const last = nodes[nodes.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Closes the open dialog and returns focus to the trigger.
 */
export function closeModal() {
  if (!backdrop) return;
  document.removeEventListener('keydown', trapFocus);
  document.body.classList.remove('scroll-lock');
  backdrop.remove();
  backdrop = null;
  if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
  previouslyFocused = null;
}

/**
 * @param {{ title: string, description?: string, confirmLabel?: string, cancelLabel?: string, onConfirm?: () => void }} options
 */
export function openModal(options) {
  closeModal();
  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'modal-title');

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn btn-icon modal-close';
  close.setAttribute('aria-label', 'Close dialog');
  close.innerHTML = icon('close', { size: 18 });
  close.addEventListener('click', closeModal);

  const title = document.createElement('h2');
  title.id = 'modal-title';
  title.textContent = options.title;

  const description = document.createElement('p');
  description.textContent = options.description ?? '';

  const actions = document.createElement('div');
  actions.className = 'modal-actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn-secondary';
  cancel.textContent = options.cancelLabel ?? 'Cancel';
  cancel.addEventListener('click', closeModal);

  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'btn btn-primary';
  confirm.textContent = options.confirmLabel ?? 'Confirm';
  confirm.addEventListener('click', () => {
    options.onConfirm?.();
    closeModal();
  });

  actions.append(cancel, confirm);
  dialog.append(close, title, description, actions);
  backdrop.append(dialog);

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal();
  });

  document.body.classList.add('scroll-lock');
  document.body.append(backdrop);
  document.addEventListener('keydown', trapFocus);
  close.focus();
}
