/**
 * @param {number} [lines]
 * @returns {string}
 */
export function skeletonLines(lines = 3) {
  return Array.from({ length: lines }, (_, index) => {
    const width = index === lines - 1 ? 'short' : index === 0 ? 'medium' : '';
    return `<span class="skeleton skeleton-line ${width}"></span>`;
  }).join('');
}

/**
 * Product-card shaped placeholder.
 * @returns {string}
 */
export function skeletonProductCard() {
  return `
    <article class="product-card" aria-hidden="true">
      <span class="skeleton skeleton-media"></span>
      <div class="product-body">
        ${skeletonLines(3)}
      </div>
    </article>
  `;
}

/**
 * @param {ParentNode} host
 * @param {'lines' | 'product'} [variant]
 */
export function mountSkeleton(host, variant = 'lines') {
  host.innerHTML = variant === 'product' ? skeletonProductCard() : skeletonLines(3);
}
