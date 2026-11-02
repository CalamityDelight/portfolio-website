// The living background. The still image (public/img/background.jpg) is always
// there in CSS; when effects are on, this script draws the same image on a WebGL
// canvas on top of it and gently moves its pixels:
//
//  1. Turquoise flows: only the turquoise parts of the image drift slowly, like
//     paint or vapour seeping through dark water.
//  2. Magnetic field: barely visible dark purple field lines (the loops around a
//     magnet) vibrate faster and harder as Earth's Kp index rises (set by field.js).
//  3. Wind on water: near the pointer the image ripples faintly and the turquoise
//     beneath the surface stirs.
//  4. A click is a drop in water: a ripple spreads, turquoise paint seeps in, then fades.
//
// WebGL runs a tiny program (a "shader") on the graphics card for every pixel,
// which is what makes moving a full-screen image smooth. If WebGL isn't
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
    uniform vec2 uRes;        // canvas size in CSS pixels
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
      vec3 sea = vec3(0.10, 0.55, 0.42); // the turquoise we add

      // 3. Wind on water near the pointer
      vec2 toPointer = px - uPointer.xy;
      float near = exp(-dot(toPointer, toPointer) / (230.0 * 230.0)) * uPointer.z;
      vec2 shift = vec2(0.0);
      if (near > 0.001) {
        shift = (vec2(fbm(px * 0.01 + t * 0.6), fbm(px * 0.01 + 7.3 - t * 0.5)) - 0.5) * near * 0.012;
      }

      // 4. Drops: a ripple ring travels outwards, and turquoise paint seeps in
      float ink = 0.0;
      for (int i = 0; i < 4; i++) {
        float age = t - uDrops[i].z;
        if (age < 0.0 || age > 4.5) continue;
        vec2 v = px - uDrops[i].xy;
        float r = length(v);
        float front = age * 240.0;
        float ring = exp(-pow((r - front) / 45.0, 2.0)) * exp(-age * 1.3);
        shift += (v / (r + 0.001)) * sin((r - front) * 0.07) * ring * 0.005;
        float edge = 40.0 + age * 70.0 + (fbm(v * 0.012 + age * 0.25) - 0.5) * 130.0; // uneven edge, like ink
        ink += smoothstep(edge, edge - 90.0, r) * smoothstep(4.5, 1.0, age) * smoothstep(0.0, 0.5, age);
      }

      // 1. Turquoise flows: read the image a little off to the side, following slow noise
      float speed = 0.015 + 0.03 * uKp;
      vec2 q = vec2(fbm(uv * 3.0 + vec2(0.0, t * speed)), fbm(uv * 3.0 + vec2(5.2, -t * speed)));
      vec2 flow = (q - 0.5) * (0.03 + 0.03 * near); // a stronger pull under the pointer
      vec3 still = texture2D(uImage, uv + shift).rgb;
      vec3 moving = texture2D(uImage, uv + shift + flow).rgb;
      vec3 color = mix(still, moving, max(turquoise(still), turquoise(moving)));

      // The turquoise beneath the surface, glimpsed where the pointer stirs
      color += sea * smoothstep(0.55, 0.85, fbm(px * 0.004 + t * 0.05)) * near * 0.14;
      // Paint from a drop, with a cloudy texture
      color += sea * clamp(ink, 0.0, 1.0) * smoothstep(0.35, 0.8, fbm(px * 0.012 + t * 0.15)) * 0.32;

      // 2. Magnetic field lines around an imaginary magnet in the middle of the screen.
      // x² / r³ is constant along a magnet's field lines, so its contours draw the loops.
      vec2 m = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float r2 = dot(m, m) + 0.02;
      float field = (m.x * m.x) / pow(r2, 1.5);
      float vibration = sin(t * (2.0 + 10.0 * uKp) + m.y * 18.0) * (0.01 + 0.04 * uKp);
      float lines = smoothstep(0.93, 1.0, abs(sin((field + vibration) * 5.0)));
      color += vec3(0.16, 0.07, 0.32) * lines * smoothstep(0.03, 0.15, r2) * (0.05 + 0.06 * uKp);

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

  // Drawing at 70% of the screen's pixels is plenty for a soft image and keeps it light
  const SCALE = 0.7;
  function resize() {
    canvas.width = Math.round(window.innerWidth * SCALE);
    canvas.height = Math.round(window.innerHeight * SCALE);
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

    pointer.energy *= 0.96; // the surface calms down when the pointer rests
    requestAnimationFrame(loop);
  }

  // ---------- The visitor touching the water ----------
  window.addEventListener('pointermove', (e) => {
    const moved = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (moved < 300) pointer.energy = Math.min(1, pointer.energy + moved / 160);
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
