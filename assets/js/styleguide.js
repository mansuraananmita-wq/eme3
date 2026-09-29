import { openModal } from './components/modal.js';
import { mountSkeleton } from './components/skeleton.js';
import { showToast } from './components/toast.js';

const TOAST_COPY = {
  info: ['New live', 'A shop you follow just went live.'],
  success: ['Added to cart', 'Linen shirt is in your bag.'],
  warning: ['Low stock', 'Only two pieces left in this size.'],
  danger: ['Payment failed', 'The card was declined. Try another method.'],
};

/**
 * Copies each light demo into its dark pane and uniques form names.
 */
function mirrorThemes() {
  document.querySelectorAll('[data-sg-mirror]').forEach((host) => {
    const source = host.querySelector('[data-sg-demo]');
    const dark = host.querySelector('[data-sg-dark]');
    if (!source || !dark || dark.querySelector('[data-sg-copy]')) return;

    const copy = source.cloneNode(true);
    if (!(copy instanceof HTMLElement)) return;

    copy.setAttribute('data-sg-copy', '');
    copy.querySelectorAll('[name]').forEach((field) => {
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
        field.name = `${field.name}-dark`;
      }
    });
    dark.append(copy);
  });
}

/**
 * Gives every tab set unique ids, including the cloned dark pane.
 */
function wireTabs() {
  document.querySelectorAll('[data-tabs]').forEach((tabs, tabsIndex) => {
    const tabButtons = [...tabs.querySelectorAll('[role="tab"]')];
    const panels = [...tabs.querySelectorAll('[role="tabpanel"]')];
    const uid = `sg-tabs-${tabsIndex}`;

    tabButtons.forEach((tab, index) => {
      const panel = panels[index];
      const selected = index === 0;
      tab.id = `${uid}-tab-${index}`;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
      if (!panel) return;
      panel.id = `${uid}-panel-${index}`;
      panel.setAttribute('aria-labelledby', tab.id);
      tab.setAttribute('aria-controls', panel.id);
      panel.hidden = !selected;
    });
  });
}

/**
 * @param {HTMLElement} tab
 */
function selectTab(tab) {
  const tabs = tab.closest('[data-tabs]');
  if (!tabs) return;

  const tabButtons = [...tabs.querySelectorAll('[role="tab"]')];
  const panels = [...tabs.querySelectorAll('[role="tabpanel"]')];
  const index = tabButtons.indexOf(tab);

  tabButtons.forEach((item, itemIndex) => {
    const selected = itemIndex === index;
    item.setAttribute('aria-selected', selected ? 'true' : 'false');
    item.tabIndex = selected ? 0 : -1;
  });

  panels.forEach((panel, panelIndex) => {
    panel.hidden = panelIndex !== index;
  });
}

function openDrawer() {
  const drawer = document.querySelector('[data-drawer]');
  const backdrop = document.querySelector('[data-drawer-backdrop]');
  if (!(drawer instanceof HTMLElement) || !(backdrop instanceof HTMLElement)) return;

  backdrop.hidden = false;
  drawer.hidden = false;
  document.body.classList.add('scroll-lock');
  drawer.querySelector('[data-drawer-close]')?.focus();
}

function closeDrawer() {
  const drawer = document.querySelector('[data-drawer]');
  const backdrop = document.querySelector('[data-drawer-backdrop]');
  if (drawer instanceof HTMLElement) drawer.hidden = true;
  if (backdrop instanceof HTMLElement) backdrop.hidden = true;
  if (!document.querySelector('.modal-backdrop')) {
    document.body.classList.remove('scroll-lock');
  }
}

function bindDemos() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const toastButton = target.closest('[data-demo-toast]');
    if (toastButton instanceof HTMLElement) {
      const variant = toastButton.dataset.demoToast || 'info';
      const copy = TOAST_COPY[variant] || TOAST_COPY.info;
      showToast({ variant, title: copy[0], message: copy[1] });
    }

    if (target.closest('[data-demo-modal]')) {
      openModal({
        title: 'Save this address?',
        description: 'You can edit saved addresses later from your profile.',
        confirmLabel: 'Save address',
        cancelLabel: 'Not now',
      });
    }

    const skeletonButton = target.closest('[data-demo-skeleton]');
    if (skeletonButton instanceof HTMLElement) {
      const host = skeletonButton.parentElement?.querySelector('[data-skeleton-host]');
      if (host) mountSkeleton(host, 'product');
    }

    if (target.closest('[data-demo-drawer]')) openDrawer();
    if (target.closest('[data-drawer-close]') || target.closest('[data-drawer-backdrop]')) closeDrawer();

    const tab = target.closest('[role="tab"]');
    if (tab instanceof HTMLElement) selectTab(tab);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();

    const tab = event.target;
    if (!(tab instanceof HTMLElement) || tab.getAttribute('role') !== 'tab') return;

    const tabs = [...(tab.parentElement?.querySelectorAll('[role="tab"]') || [])];
    const index = tabs.indexOf(tab);
    if (index < 0) return;

    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else return;

    event.preventDefault();
    const target = tabs[next];
    if (target instanceof HTMLElement) {
      selectTab(target);
      target.focus();
    }
  });
}

mirrorThemes();
wireTabs();
bindDemos();
