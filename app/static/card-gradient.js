// Ports the AnimatedGradient WebGL2 shader component to a plain <canvas>
// (no React / framer-motion / @paper-design deps in this stack). The
// fragment shader below is copied verbatim from that component; only the
// React refs/state are replaced with plain closures.
//
// Every `.card` rendered by the Jinja `{% for book in books %}` loop gets
// its own `<canvas class="card-gradient">` (see index.html), so this
// keeps working no matter how many books are in the catalog -- new cards
// just get picked up by the querySelectorAll below. To stay cheap with a
// large catalog, each canvas's WebGL context is created lazily (only the
// first time it scrolls into view), the render loop pauses whenever the
// card scrolls off-screen, and the context is released once the card is far
// away -- browsers only allow ~16 live WebGL contexts per page.
(function () {
  const VERTEX_SHADER = `#version 300 es
in vec4 a_position;
void main() {
  gl_Position = a_position;
}`;

  const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;

uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {
    vec3 color1 = c1.rgb * c1.a;
    vec3 color2 = c2.rgb * c2.a;
    vec3 color3 = c3.rgb * c3.a;

    float r1 = smoothstep(.0 + .35 * edgesWidth, .7 - .35 * edgesWidth + .5 * edge_blur, mixer);
    float r2 = smoothstep(.3 + .35 * edgesWidth, 1. - .35 * edgesWidth + edge_blur, mixer);

    vec3 blended_color_2 = mix(color1, color2, r1);
    float blended_opacity_2 = mix(c1.a, c2.a, r1);

    vec3 c = mix(blended_color_2, color3, r2);
    float o = mix(blended_opacity_2, c3.a, r2);
    return vec4(c, o);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    float t = .5 * u_time;

    float noise_scale = .0005 + .006 * u_scale;

    uv -= .5;
    uv *= (noise_scale * u_resolution);
    uv = rotate(uv, u_rotation * .5 * PI);
    uv /= u_pixelRatio;
    uv += .5;

    float n1 = noise(uv * 1. + t);
    float n2 = noise(uv * 2. - t);
    float angle = n1 * TWO_PI;
    uv.x += 4. * u_distortion * n2 * cos(angle);
    uv.y += 4. * u_distortion * n2 * sin(angle);

    float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));
    for (float i = 1.; i <= iterations_number; i++) {
        uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);
        uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);
    }

    float proportion = clamp(u_proportion, 0., 1.);

    float shape = 0.;
    float mixer = 0.;
    if (u_shape < .5) {
      vec2 checks_shape_uv = uv * (.5 + 3.5 * u_shapeScale);
      shape = .5 + .5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else if (u_shape < 1.5) {
      vec2 stripes_shape_uv = uv * (.25 + 3. * u_shapeScale);
      float f = fract(stripes_shape_uv.y);
      shape = smoothstep(.0, .55, f) * smoothstep(1., .45, f);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else {
      float sh = 1. - uv.y;
      sh -= .5;
      sh /= (noise_scale * u_resolution.y);
      sh += .5;
      float shape_scaling = .2 * (1. - u_shapeScale);
      shape = smoothstep(.45 - shape_scaling, .55 + shape_scaling, sh + .3 * (proportion - .5));
      mixer = shape;
    }

    vec4 color_mix = blend_colors(u_color1, u_color2, u_color3, mixer, 1. - clamp(u_softness, 0., 1.), .01 + .01 * u_scale);

    fragColor = vec4(color_mix.rgb, color_mix.a);
}
`;

  function hexToRgba(hex) {
    const c = hex.replace("#", "");
    return [
      parseInt(c.slice(0, 2), 16) / 255,
      parseInt(c.slice(2, 4), 16) / 255,
      parseInt(c.slice(4, 6), 16) / 255,
      1,
    ];
  }

  // "Zen Linen" preset: charcoal neutrals + terracotta accent, matching
  // the site's re-theme (see style.css :root). Kept gentler (lower
  // distortion/swirl) than the original Aurora defaults so text sitting
  // on top of it stays readable.
  const PRESET = {
    color1: hexToRgba("#1c1c1c"),
    color2: hexToRgba("#2c2c2c"),
    color3: hexToRgba("#f26a4b"),
    rotation: -45,
    proportion: 0.6,
    scale: 0.6,
    speed: 8,
    distortion: 0.5,
    swirl: 0.5,
    swirlIterations: 8,
    softness: 1,
    shape: 2, // Edge
    shapeSize: 0.5,
  };

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function initCard(canvas) {
    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: true,
      alpha: true,
      antialias: true,
    });
    if (!gl) return null; // no WebGL2 -- card keeps its flat fallback color

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return null;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const u = {
      time: gl.getUniformLocation(program, "u_time"),
      resolution: gl.getUniformLocation(program, "u_resolution"),
      pixelRatio: gl.getUniformLocation(program, "u_pixelRatio"),
      scale: gl.getUniformLocation(program, "u_scale"),
      rotation: gl.getUniformLocation(program, "u_rotation"),
      color1: gl.getUniformLocation(program, "u_color1"),
      color2: gl.getUniformLocation(program, "u_color2"),
      color3: gl.getUniformLocation(program, "u_color3"),
      proportion: gl.getUniformLocation(program, "u_proportion"),
      softness: gl.getUniformLocation(program, "u_softness"),
      shape: gl.getUniformLocation(program, "u_shape"),
      shapeScale: gl.getUniformLocation(program, "u_shapeScale"),
      distortion: gl.getUniformLocation(program, "u_distortion"),
      swirl: gl.getUniformLocation(program, "u_swirl"),
      swirlIterations: gl.getUniformLocation(program, "u_swirlIterations"),
    };

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = null;
    const start = performance.now();

    function frame(now) {
      const elapsed = (now - start) / 1000;
      const speed = (PRESET.speed / 100) * 5;

      gl.uniform1f(u.time, elapsed * speed);
      gl.uniform2f(u.resolution, canvas.width, canvas.height);
      gl.uniform1f(u.pixelRatio, window.devicePixelRatio || 1);
      gl.uniform1f(u.scale, PRESET.scale);
      gl.uniform1f(u.rotation, (PRESET.rotation * Math.PI) / 180);
      gl.uniform4f(u.color1, ...PRESET.color1);
      gl.uniform4f(u.color2, ...PRESET.color2);
      gl.uniform4f(u.color3, ...PRESET.color3);
      gl.uniform1f(u.proportion, PRESET.proportion);
      gl.uniform1f(u.softness, PRESET.softness);
      gl.uniform1f(u.shape, PRESET.shape);
      gl.uniform1f(u.shapeScale, PRESET.shapeSize);
      gl.uniform1f(u.distortion, PRESET.distortion);
      gl.uniform1f(u.swirl, PRESET.swirl);
      gl.uniform1f(u.swirlIterations, PRESET.swirlIterations);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(frame);
    }

    return {
      play() {
        if (raf === null) raf = requestAnimationFrame(frame);
      },
      pause() {
        if (raf !== null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
      },
      destroy() {
        this.pause();
        ro.disconnect();
        const lose = gl.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
      },
    };
  }

  // At most this many cards hold a live WebGL context at once (the button
  // shader needs one more); the ones farthest from the viewport centre are
  // released first and simply fall back to the card's flat dark background.
  const MAX_LIVE = 10;

  function setup() {
    const canvases = document.querySelectorAll("canvas.card-gradient");
    if (canvases.length === 0) return;

    const live = new Map(); // canvas -> controller
    let io;

    // A canvas that lost its context can't get a new one, so swap in a fresh node.
    function release(canvas) {
      const controller = live.get(canvas);
      if (!controller) return;
      controller.destroy();
      live.delete(canvas);
      const fresh = canvas.cloneNode(false);
      canvas.replaceWith(fresh);
      io.unobserve(canvas);
      io.observe(fresh);
    }

    function distanceFromCentre(canvas) {
      const r = canvas.getBoundingClientRect();
      return Math.abs(r.top + r.height / 2 - window.innerHeight / 2);
    }

    function evictFarthest(except) {
      let worst = null;
      let worstD = -1;
      live.forEach((_, c) => {
        if (c === except) return;
        const d = distanceFromCentre(c);
        if (d > worstD) {
          worstD = d;
          worst = c;
        }
      });
      if (worst) release(worst);
    }

    io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const canvas = entry.target;
          let controller = live.get(canvas);
          if (entry.isIntersecting) {
            if (!controller) {
              if (live.size >= MAX_LIVE) evictFarthest(canvas);
              controller = initCard(canvas);
              if (controller) live.set(canvas, controller);
            }
            if (controller) controller.play();
          } else if (controller) {
            // off-screen: stop drawing; the context is only freed when evicted
            controller.pause();
          }
        });
      },
      { rootMargin: "200px", threshold: [0, 0.01] }
    );
    canvases.forEach((canvas) => io.observe(canvas));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
