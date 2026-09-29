import { icon } from '../core/icons.js';

const VARIANTS = new Set(['info', 'success', 'warning', 'danger']);
const ICONS = {
  info: 'info',
  success: 'check',
  warning: 'warning',
  danger: 'alert',
};

/**
 * @returns {HTMLElement}
 */
function getStack() {
  let stack = document.querySelector('.toast-stack');
  if (stack) return stack;

  stack = document.createElement('div');
  stack.className = 'toast-stack';
  stack.setAttribute('aria-live', 'polite');
  stack.setAttribute('aria-relevant', 'additions');
  document.body.append(stack);
  return stack;
}

/**
 * @param {HTMLElement} toast
 */
function dismiss(toast) {
  toast.remove();
}

/**
 * @param {{ title?: string, message: string, variant?: 'info' | 'success' | 'warning' | 'danger', duration?: number }} options
 * @returns {HTMLElement}
 */
export function showToast(options) {
  const variant = VARIANTS.has(options.variant) ? options.variant : 'info';
  const stack = getStack();

  const toast = document.createElement('div');
  toast.className = `toast toast-${variant}`;
  toast.setAttribute('role', variant === 'danger' ? 'alert' : 'status');

  const glyph = document.createElement('span');
  glyph.className = 'toast-icon';
  glyph.innerHTML = icon(ICONS[variant], { size: 18 });

  const copy = document.createElement('div');
  if (options.title) {
    const title = document.createElement('strong');
    title.textContent = options.title;
    copy.append(title);
  }
  const message = document.createElement('p');
  message.textContent = options.message;
  copy.append(message);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn btn-icon';
  close.setAttribute('aria-label', 'Dismiss notification');
  close.innerHTML = icon('close', { size: 18 });
  close.addEventListener('click', () => dismiss(toast));

  toast.append(glyph, copy, close);
  stack.append(toast);

  while (stack.children.length > 4) {
    stack.firstElementChild?.remove();
  }

  const duration = options.duration ?? 4200;
  if (duration > 0) {
    window.setTimeout(() => dismiss(toast), duration);
  }

  return toast;
}
