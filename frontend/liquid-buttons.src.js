// Liquid-metal buttons for every `.btn-liquid` on the page.
//
// This is a vanilla-JS port of the React <LiquidMetalButton /> component: it
// uses the very same @paper-design/shaders liquid-metal fragment shader and
// uniforms, plus the same hover / press / ripple behaviour.
//
// One WebGL context per button would blow through the browser limit (~16)
// as soon as the catalog grows, so a SINGLE shader is rendered into an
// off-screen canvas and every visible button mirrors a slice of it into its
// own cheap 2D canvas. Without WebGL the CSS gradient rim in style.css
// stays in place, so buttons still look metallic.
import { liquidMetalFragmentShader, ShaderMount } from "@paper-design/shaders";

// css size of the shared shader surface: the original component's button size,
// which is what the shader's circle/rim was tuned for. Wider buttons stretch it.
const SRC_W = 142;
const SRC_H = 46;
const SPEED_IDLE = 0.6;
const SPEED_HOVER = 1;
const SPEED_CLICK = 2.4;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let mount = null;
let source = null; // the shader's <canvas>
let failed = false;
let raf = null;
let hovering = 0;

/** @type {Map<HTMLElement, {canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, offset: number}>} */
const tracked = new Map();
const visible = new Set();

function ensureShader() {
  if (mount || failed) return !failed;
  try {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      `position:fixed;left:0;top:0;width:${SRC_W}px;height:${SRC_H}px;` +
      "opacity:0;pointer-events:none;z-index:-1;overflow:hidden;";
    document.body.appendChild(host);

    mount = new ShaderMount(
      host,
      liquidMetalFragmentShader,
      {
        u_repetition: 4,
        u_softness: 0.5,
        u_shiftRed: 0.3,
        u_shiftBlue: 0.3,
        u_distortion: 0,
        u_contour: 0,
        u_angle: 45,
        u_scale: 8,
        u_shape: 1,
        u_offsetX: 0.1,
        u_offsetY: -0.1,
      },
      { preserveDrawingBuffer: true },
      reducedMotion.matches ? 0 : SPEED_IDLE,
      0,
      4, // render at >=4x so the rim stays crisp when stretched over wide buttons
    );
    source = host.querySelector("canvas");
    return true;
  } catch (err) {
    failed = true;
    document.documentElement.classList.add("lm-static");
    console.warn("Liquid buttons: WebGL unavailable, using CSS fallback.", err);
    return false;
  }
}

function setSpeed(speed) {
  if (mount && !reducedMotion.matches) mount.setSpeed(speed);
}

function drawButton(btn, info) {
  const { canvas, ctx, offset } = info;
  const rect = btn.getBoundingClientRect();
  if (!rect.width || !rect.height || !source || !source.width) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  // crop a slice with the button's aspect ratio out of the shared surface
  const sh = source.height;
  const sw = Math.min(source.width, sh * (rect.width / rect.height));
  const sx = (source.width - sw) * offset;
  ctx.drawImage(source, sx, 0, sw, sh, 0, 0, w, h);
}

function frame() {
  raf = null;
  visible.forEach((btn) => drawButton(btn, tracked.get(btn)));
  if (visible.size && !reducedMotion.matches) raf = requestAnimationFrame(frame);
}

function kick() {
  if (raf === null && visible.size) raf = requestAnimationFrame(frame);
}

function attach(btn) {
  const canvas = document.createElement("canvas");
  canvas.className = "lm-canvas";
  canvas.setAttribute("aria-hidden", "true");
  btn.prepend(canvas);
  btn.classList.add("has-canvas");
  // small deterministic variation so neighbouring buttons don't look identical
  tracked.set(btn, { canvas, ctx: canvas.getContext("2d"), offset: Math.random() });
}

function setup() {
  const buttons = document.querySelectorAll(".btn-liquid");
  if (!buttons.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) {
          if (!ensureShader()) return;
          if (!tracked.has(target)) attach(target);
          visible.add(target);
        } else {
          visible.delete(target);
        }
      });
      // idle the shader entirely when nothing is on screen
      if (mount) setSpeed(visible.size ? (hovering ? SPEED_HOVER : SPEED_IDLE) : 0);
      kick();
      if (reducedMotion.matches) {
        // static mode: the shader paints its first frame a moment later
        setTimeout(kick, 150);
        setTimeout(kick, 600);
      }
    },
    { rootMargin: "80px" },
  );
  buttons.forEach((b) => io.observe(b));

  // hover -> faster flow (same as the React component)
  document.addEventListener("pointerover", (e) => {
    const btn = e.target.closest?.(".btn-liquid");
    if (!btn || btn.contains(e.relatedTarget)) return;
    hovering++;
    setSpeed(SPEED_HOVER);
  });
  document.addEventListener("pointerout", (e) => {
    const btn = e.target.closest?.(".btn-liquid");
    if (!btn || btn.contains(e.relatedTarget)) return;
    hovering = Math.max(0, hovering - 1);
    if (!hovering) setSpeed(SPEED_IDLE);
  });

  // click -> burst of speed + ripple
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.(".btn-liquid");
    if (!btn) return;

    setSpeed(SPEED_CLICK);
    setTimeout(() => setSpeed(hovering ? SPEED_HOVER : SPEED_IDLE), 300);

    if (reducedMotion.matches) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  });

  window.addEventListener("resize", kick);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setup);
} else {
  setup();
}
