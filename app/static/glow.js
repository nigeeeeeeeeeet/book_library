// Tracks the pointer across the whole page and exposes its position as CSS
// custom properties on :root. Card glow (see style.css, .card::before/::after)
// and the ambient page background read these to render a spotlight that
// follows the cursor.
(function () {
  const root = document.documentElement;

  function setPos(x, y) {
    root.style.setProperty("--x", x.toFixed(2));
    root.style.setProperty("--xp", (x / window.innerWidth).toFixed(2));
    root.style.setProperty("--y", y.toFixed(2));
    root.style.setProperty("--yp", (y / window.innerHeight).toFixed(2));
  }

  // Show the glow right away (centered-ish) instead of waiting for the
  // first mouse move -- otherwise the page looks flat until you touch it.
  setPos(window.innerWidth / 2, window.innerHeight / 3);

  document.addEventListener("pointermove", (e) => setPos(e.clientX, e.clientY));
})();

