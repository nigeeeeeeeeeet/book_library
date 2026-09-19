// Small UI helpers: live search, count-up stats, cover preview.
(function () {
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- count-up numbers in the hero ---------------------------------------
  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count);
    if (calm || !Number.isFinite(target) || target < 2) return;
    const duration = 900;
    const t0 = performance.now();
    el.textContent = "0";
    (function tick(now) {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-US");
      if (t < 1) requestAnimationFrame(tick);
    })(t0);
  });

  // ---- live search --------------------------------------------------------
  const input = document.getElementById("search");
  if (input) {
    const cards = Array.from(document.querySelectorAll(".card"));
    const count = document.getElementById("result-count");
    const none = document.getElementById("no-match");

    function filter() {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      cards.forEach((card) => {
        const hit = !q || card.dataset.title.includes(q) || card.dataset.author.includes(q);
        card.hidden = !hit;
        if (hit) shown++;
      });
      count.textContent = q ? `${shown} of ${cards.length} books` : "";
      none.classList.toggle("show", shown === 0);
    }

    input.addEventListener("input", filter);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        input.value = "";
        filter();
        input.blur();
      }
    });
    // "/" jumps to the search box (like on GitHub)
    document.addEventListener("keydown", (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "/" && !["input", "textarea", "select"].includes(tag)) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  // ---- cover preview on the "add book" form ---------------------------------
  document.querySelectorAll("input[type=file][data-preview]").forEach((field) => {
    const img = document.getElementById(field.dataset.preview);
    if (!img) return;
    field.addEventListener("change", () => {
      const file = field.files && field.files[0];
      if (!file) {
        img.classList.remove("show");
        return;
      }
      if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
      img.dataset.url = URL.createObjectURL(file);
      img.src = img.dataset.url;
      img.classList.add("show");
    });
  });
})();
