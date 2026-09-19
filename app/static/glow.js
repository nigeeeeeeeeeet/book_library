// Pointer effects:
//  1. exposes the pointer position on :root (--x/--y) for the ambient page
//     spotlight in style.css;
//  2. writes the pointer position *relative to each nearby card* (--gx/--gy)
//     so the card-border glow follows the cursor across the whole grid (and
//     keeps working while a card is lifted/tilted);
//  3. gives the hovered card a subtle 3D tilt.
(function () {
  const root = document.documentElement;
  const cards = Array.from(document.querySelectorAll(".card"));
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const GLOW_REACH = 320; // px: cards farther than this from the pointer stay dark

  let px = window.innerWidth / 2;
  let py = window.innerHeight / 3;
  let queued = false;

  function paint() {
    queued = false;
    root.style.setProperty("--x", px.toFixed(2));
    root.style.setProperty("--y", py.toFixed(2));

    for (const card of cards) {
      const r = card.getBoundingClientRect();
      const near =
        px > r.left - GLOW_REACH && px < r.right + GLOW_REACH &&
        py > r.top - GLOW_REACH && py < r.bottom + GLOW_REACH;
      if (near) {
        card.style.setProperty("--gx", (px - r.left).toFixed(1));
        card.style.setProperty("--gy", (py - r.top).toFixed(1));
      } else if (card.style.getPropertyValue("--gx")) {
        card.style.removeProperty("--gx");
        card.style.removeProperty("--gy");
      }
    }
  }

  function schedule() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(paint);
    }
  }

  // Show the glow right away (centered-ish) instead of waiting for the
  // first mouse move -- otherwise the page looks flat until you touch it.
  schedule();

  document.addEventListener("pointermove", (e) => {
    px = e.clientX;
    py = e.clientY;
    schedule();
  });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);

  // ---- 3D tilt ------------------------------------------------------------
  if (!fine.matches || calm.matches) return;

  cards.forEach((card) => {
    card.addEventListener("pointerenter", () => card.classList.add("tilting"));
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--ry", (nx * 9).toFixed(2) + "deg");
      card.style.setProperty("--rx", (ny * -7).toFixed(2) + "deg");
    });
    card.addEventListener("pointerleave", () => {
      card.classList.remove("tilting");
      card.style.removeProperty("--rx");
      card.style.removeProperty("--ry");
    });
  });
})();
