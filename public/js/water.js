// The living background. The still image (public/img/background.jpg) is always
// there in CSS; this script draws the same image on a WebGL canvas on top of it
// and brings it to life:
//
//  1. Vapour: turquoise tendrils, built from layered noise and shaped after the
//     image, seep in from the edges and slowly draw back, like paint in dark water.
//     The image's own turquoise drifts along with them. Earth's Kp index (from
//     field.js) makes the flow a little faster in a disturbed field.
//  2. Wind on water: under the pointer the surface ripples faintly and turquoise
//     light shows through, in a small area.
//  3. A click is a drop of paint: a ripple spreads and a tiny bloom of turquoise
//     seeps out from that spot, then dissolves.
//
// WebGL runs a small program (a "shader") on the graphics card for every pixel,
// which is what makes animating a full-screen image smooth. If WebGL isn't
// available, the still image simply stays.

(function () {
  const canvas = document.getElementById('water');
  const gl = canvas && canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });

  // Something to control even when WebGL is missing, so field.js keeps working
  const api = { setIntensity() {}, setEnabled() {} };
  window.magneticField = api;
  if (!gl) return;

  // ---------- The shaders ----------
  // Vertex shader: draws one rectangle covering the screen.
  const VERTEX = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); // 0–1, top-left origin like the page
      gl_Position = vec4(aPos, 0.0, 1.0);
    }`;

  // Fragment shader: decides the colour of every pixel, every frame.
  const FRAGMENT = `
    precision highp float;
    uniform sampler2D uImage;
    uniform vec2 uRes;        // screen size in CSS pixels
    uniform vec2 uImageSize;
    uniform float uTime;      // seconds
    uniform float uKp;        // 0 = calm … 1 = extreme storm
    uniform vec3 uPointer;    // x, y in pixels, and how much it is stirring the water (0–1)
    uniform vec3 uDrops[4];   // clicks: x, y, start time
    varying vec2 vUv;

    // Smooth random "noise", layered (fbm) for natural, cloudy shapes
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
      return v;
    }

    // How turquoise a colour is: lots of green, little red
    float turquoise(vec3 c) { return clamp((c.g - max(c.r, c.b * 0.75)) * 6.0, 0.0, 1.0); }

    // Fit the image to the screen like CSS "background-size: cover"
    vec2 cover(vec2 uv) {
      float screen = uRes.x / uRes.y, image = uImageSize.x / uImageSize.y;
      vec2 scale = screen > image ? vec2(1.0, image / screen) : vec2(screen / image, 1.0);
      return (uv - 0.5) * scale + 0.5;
    }

    void main() {
      vec2 px = vUv * uRes;
      vec2 uv = cover(vUv);
      float t = uTime;
      vec3 sea = vec3(0.12, 0.62, 0.48);      // the turquoise we paint with
      vec3 deep = vec3(0.13, 0.07, 0.26);     // the purple swirls

      // Pointer: a small area of water it is touching
      vec2 toPointer = px - uPointer.xy;
      float near = exp(-dot(toPointer, toPointer) / (110.0 * 110.0)) * uPointer.z;

      // Drops: a ripple ring travels outwards, and a tiny bloom of paint seeps out
      vec2 shift = vec2(0.0);
      float ink = 0.0;
      for (int i = 0; i < 4; i++) {
        float age = t - uDrops[i].z;
        if (age < 0.0 || age > 4.0) continue;
        vec2 v = px - uDrops[i].xy;
        float r = length(v);
        float front = age * 220.0;
        float ring = exp(-pow((r - front) / 35.0, 2.0)) * exp(-age * 1.6);
        shift += (v / (r + 0.001)) * sin((r - front) * 0.08) * ring * 0.004;
        // the bloom grows to ~70px with a ragged, inky edge, then fades
        float edge = 8.0 + 55.0 * (1.0 - exp(-age * 1.4)) + (fbm(v * 0.03 + age * 0.4) - 0.5) * 50.0;
        // (1 - smoothstep) = "inside the edge" and "not yet faded"; smoothstep needs its edges in order
        ink += (1.0 - smoothstep(edge - 30.0, edge, r)) * (1.0 - smoothstep(1.2, 4.0, age)) * smoothstep(0.0, 0.25, age);
      }
      if (near > 0.001) {
        shift += (vec2(fbm(px * 0.012 + t * 0.7), fbm(px * 0.012 + 7.3 - t * 0.6)) - 0.5) * near * 0.01;
      }

      // 1. The image, with its own turquoise drifting along a slow current
      float speed = 0.03 + 0.04 * uKp;
      vec2 p = uv * 2.6;
      vec2 q = vec2(fbm(p + vec2(0.0, t * speed)), fbm(p + vec2(5.2, -t * speed)));
      vec3 still = texture2D(uImage, uv + shift).rgb;
      vec3 moving = texture2D(uImage, uv + shift + (q - 0.5) * 0.06).rgb;
      vec3 color = mix(still, moving, max(turquoise(still), turquoise(moving)));

      // Vapour: noise folded into itself ("domain warping") gives curling tendrils.
      // 1 - |2v - 1| turns soft clouds into thin filaments, like paint threads in water.
      vec2 r2 = vec2(fbm(p * 1.4 + 4.0 * q + vec2(1.7, 9.2) + t * speed * 1.5),
                     fbm(p * 1.4 + 4.0 * q + vec2(8.3, 2.8) - t * speed * 1.2));
      float v = fbm(p * 1.4 + 3.5 * r2);
      float filament = pow(1.0 - abs(2.0 * v - 1.0), 14.0) * smoothstep(0.35, 0.65, fbm(p * 0.9 - t * speed));

      // The vapour lives near the edges, and its reach breathes in and out slowly
      vec2 e = min(vUv, 1.0 - vUv);
      float edgeDist = min(e.x * uRes.x / uRes.y, e.y);
      float reach = 0.1 + 0.06 * sin(t * 0.12 + v * 6.0) + 0.04 * uKp;
      float edgeMask = 1.0 - smoothstep(0.0, reach, edgeDist);
      color += sea * filament * edgeMask * 0.45;
      color += deep * pow(v, 3.0) * edgeMask * 0.35;

      // 2. Turquoise stirred up just under the pointer: thin veins of light, not a flat glow
      if (near > 0.001) {
        float lv = fbm(px * 0.011 + vec2(t * 0.5, -t * 0.35));
        float veins = pow(1.0 - abs(2.0 * lv - 1.0), 5.0);
        color += sea * near * (0.05 + 0.75 * veins);
      }

      // 3. The paint from a drop, threaded like the vapour
      color += sea * clamp(ink, 0.0, 1.0) * (0.5 + 0.9 * smoothstep(0.3, 0.8, fbm(px * 0.035 + t * 0.3)));

      gl_FragColor = vec4(color, 1.0);
    }`;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (err) {
    console.warn('Background animation off:', err.message);
    return; // the still CSS image stays
  }
  gl.useProgram(program);

  // One rectangle (two triangles) covering the whole canvas
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = (name) => gl.getUniformLocation(program, name);
  const uniforms = {
    res: u('uRes'), imageSize: u('uImageSize'), time: u('uTime'),
    kp: u('uKp'), pointer: u('uPointer'), drops: u('uDrops'),
  };

  // ---------- State ----------
  let intensity = 0.2;
  let enabled = false;
  let ready = false; // true once the image has loaded
  const pointer = { x: -9999, y: -9999, energy: 0 };
  const drops = new Float32Array(12).fill(-100); // 4 drops × (x, y, start time); -100 = none
  let nextDrop = 0;
  const start = performance.now();
  const seconds = () => (performance.now() - start) / 1000;

  // ---------- The image ----------
  const image = new Image();
  image.onload = () => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    // The image size isn't a power of two, so: no repeating, no mipmaps
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform2f(uniforms.imageSize, image.width, image.height);
    ready = true;
    if (enabled) requestAnimationFrame(loop);
  };
  image.src = '/img/background.jpg';

  // Draw at the screen's real pixel density (Retina = 2 pixels per CSS pixel),
  // so the image stays as sharp as the original
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  function loop() {
    if (!enabled || !ready) return;
    gl.uniform2f(uniforms.res, window.innerWidth, window.innerHeight);
    gl.uniform1f(uniforms.time, seconds());
    gl.uniform1f(uniforms.kp, intensity);
    gl.uniform3f(uniforms.pointer, pointer.x, pointer.y, pointer.energy);
    gl.uniform3fv(uniforms.drops, drops);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    canvas.classList.add('is-live'); // fade the canvas in over the still image

    pointer.energy *= 0.95; // the surface calms down when the pointer rests
    requestAnimationFrame(loop);
  }

  // ---------- The visitor touching the water ----------
  window.addEventListener('pointermove', (e) => {
    const moved = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (moved < 300) pointer.energy = Math.min(1, pointer.energy + moved / 90);
  }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    drops.set([e.clientX, e.clientY, seconds()], nextDrop * 3);
    nextDrop = (nextDrop + 1) % 4; // keep the last four drops
  }, { passive: true });

  // field.js controls the background through these
  api.setIntensity = (value) => { intensity = Math.max(0, Math.min(1, value)); };
  api.setEnabled = (on) => {
    const wasOn = enabled;
    enabled = on;
    if (!on) canvas.classList.remove('is-live'); // back to the still image
    if (on && !wasOn) requestAnimationFrame(loop);
  };
})();
