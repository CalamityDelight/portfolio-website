// The hero portrait: a looping video of digital rain on Axel's face, drawn so
// that the dark parts become transparent. The face and the rain seem to appear
// straight out of the purple background, with no visible video rectangle.
//
// Why WebGL: the portrait sits inside the 3D cube face, which is drawn as its own
// layer, so the usual CSS trick (mix-blend-mode: screen) can't see the background.
// Instead a tiny shader reads each video frame and turns brightness into opacity:
// black → fully transparent, bright rain → fully visible. The edges fade out too.

const FRAGMENT = `
  precision mediump float;
  uniform sampler2D uVideo;
  uniform vec2 uScale;     // how much of the video fits the canvas ("cover", like CSS)
  varying vec2 vUv;
  void main() {
    vec2 uv = (vUv - 0.5) * uScale + vec2(0.5, 0.46); // centred, nudged up a little towards the face
    vec3 c = texture2D(uVideo, uv).rgb;
    float light = max(c.r, max(c.g, c.b));
    float alpha = smoothstep(0.015, 0.25, light);    // dark becomes see-through, dim light stays faintly
    vec2 d = abs(vUv - 0.5) * 2.0;                   // 0 in the middle, 1 at the edges
    alpha *= (1.0 - smoothstep(0.65, 1.0, d.x)) * (1.0 - smoothstep(0.7, 1.0, d.y));
    gl_FragColor = vec4(min(c * 1.5, 1.0), alpha);   // a little brighter, so the face can just be made out
  }`;

const VERTEX = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

export function initPortrait() {
  const holder = document.querySelector('.portrait');
  if (!holder) return;
  const canvas = holder.querySelector('canvas');
  const panel = holder.closest('.panel');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The video itself is never shown; it only feeds the canvas
  const video = document.createElement('video');
  video.src = holder.dataset.src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';

  const gl = canvas.getContext('webgl', { premultipliedAlpha: false });
  if (!gl) {
    // No WebGL: show the plain video with softly faded edges instead
    video.className = 'portrait__fallback';
    video.autoplay = !reducedMotion;
    holder.replaceChild(video, canvas);
    return;
  }

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const uScale = gl.getUniformLocation(program, 'uScale');

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Match the canvas to its size on screen, and work out the "cover" crop
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(holder.clientWidth * dpr);
    canvas.height = Math.round(holder.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const canvasRatio = canvas.width / canvas.height;
    const videoRatio = (video.videoWidth || 9) / (video.videoHeight || 16);
    // Show the full width of the video and as much height as fits (or the other way round)
    gl.uniform2f(uScale, Math.min(1, canvasRatio / videoRatio) || 1, Math.min(1, videoRatio / canvasRatio) || 1);
  }
  new ResizeObserver(resize).observe(holder);
  video.addEventListener('loadedmetadata', resize);

  function draw() {
    if (video.readyState < 2) return; // no frame yet
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Draw only when the video has a new frame (where the browser supports it), otherwise every animation frame
  function onFrame() {
    draw();
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(onFrame);
    else if (!video.paused) requestAnimationFrame(onFrame);
  }
  video.addEventListener('playing', () => {
    if (!video.requestVideoFrameCallback) requestAnimationFrame(onFrame);
  });
  if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(onFrame);

  // Play only while the intro face is the one in view; pause everywhere else
  function update() {
    const visible = panel.classList.contains('is-active') && !document.hidden;
    if (visible && video.paused && !reducedMotion) video.play().catch(() => {});
    if (!visible && !video.paused) video.pause();
  }
  new MutationObserver(update).observe(panel, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', update);

  if (reducedMotion) video.addEventListener('loadeddata', draw, { once: true }); // one still frame
  update();
}
