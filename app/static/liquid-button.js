// Ripple-on-click for .btn-liquid buttons/links, ported from the
// LiquidMetalButton React component's ripple behaviour.
(function () {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-liquid");
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;

    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  });
})();
