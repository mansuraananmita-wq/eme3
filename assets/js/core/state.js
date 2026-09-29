/**
 * @typedef {Object} AppState
 * @property {number} cartCount
 * @property {number} wishlistCount
 * @property {{ id: string, name: string } | null} user
 */

/** @type {AppState} */
const state = {
  cartCount: 0,
  wishlistCount: 0,
  user: null,
};

/** @type {Set<(snapshot: AppState) => void>} */
const listeners = new Set();

/**
 * @returns {AppState}
 */
export function getState() {
  return {
    cartCount: state.cartCount,
    wishlistCount: state.wishlistCount,
    user: state.user ? { ...state.user } : null,
  };
}

/**
 * @param {(snapshot: AppState) => void} listener
 * @returns {() => void}
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * @param {Partial<AppState>} partial
 */
export function setState(partial) {
  Object.assign(state, partial);
  const snapshot = getState();
  listeners.forEach((listener) => listener(snapshot));
}
