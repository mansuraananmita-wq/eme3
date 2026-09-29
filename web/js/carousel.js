/**
 * Shared carousel helper: autoplay, arrows, dots, swipe, reduced-motion.
 */

/**
 * @param {HTMLElement} root
 * @param {{ intervalMs?: number }} [options]
 */
export function mountCarousel(root, options = {}) {
  const track = root.querySelector("[data-carousel-track]");
  const dots = root.querySelector("[data-carousel-dots]");
  if (!(track instanceof HTMLElement)) return;

  const slides = [...track.children];
  if (!slides.length) return;

  let index = 0;
  let timer = 0;
  let touchX = null;
  const intervalMs = options.intervalMs ?? 5000;
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (dots instanceof HTMLElement) {
    dots.innerHTML = slides
      .map((_, i) => `
        <button type="button" aria-label="Slide ${i + 1}" class="${i === 0 ? "is-active" : ""}" data-dot="${i}"></button>
      `)
      .join("");
  }

  const paint = () => {
    track.style.transform = `translateX(-${index * 100}%)`;
    root.querySelectorAll("[data-dot]").forEach((button, i) => {
      button.classList.toggle("is-active", i === index);
      button.setAttribute("aria-current", i === index ? "true" : "false");
    });
  };

  const go = (next) => {
    index = (next + slides.length) % slides.length;
    paint();
  };

  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = 0;
  };

  const start = () => {
    stop();
    if (reduced() || slides.length < 2) return;
    timer = window.setInterval(() => go(index + 1), intervalMs);
  };

  root.querySelector("[data-carousel-prev]")?.addEventListener("click", () => {
    go(index - 1);
    start();
  });
  root.querySelector("[data-carousel-next]")?.addEventListener("click", () => {
    go(index + 1);
    start();
  });
  root.querySelectorAll("[data-dot]").forEach((button) => {
    button.addEventListener("click", () => {
      go(Number(button.getAttribute("data-dot")) || 0);
      start();
    });
  });

  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  root.addEventListener("focusin", stop);
  root.addEventListener("focusout", (event) => {
    if (!root.contains(event.relatedTarget)) start();
  });

  track.addEventListener("touchstart", (event) => {
    touchX = event.changedTouches[0]?.clientX ?? null;
    stop();
  }, { passive: true });

  track.addEventListener("touchend", (event) => {
    if (touchX == null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchX;
    const delta = endX - touchX;
    touchX = null;
    if (Math.abs(delta) > 40) go(delta < 0 ? index + 1 : index - 1);
    start();
  }, { passive: true });

  paint();
  start();
}
