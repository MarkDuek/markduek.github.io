// @ts-check

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("terrain-canvas"));
const surface = /** @type {HTMLElement} */ (document.getElementById("topography"));

function start() {
  const context = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!context || !context.getExtension("OES_standard_derivatives")) return;
  const gl = context;

  /** @param {number} type @param {string} source */
  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Unable to allocate a shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Topography shader: ${log}`);
    }
    return shader;
  }

  const vertex = compile(gl.VERTEX_SHADER, document.getElementById("terrain-vertex")?.textContent ?? "");
  const fragment = compile(gl.FRAGMENT_SHADER, document.getElementById("terrain-fragment")?.textContent ?? "");
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to allocate a shader program.");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Topography program: ${log}`);
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("Unable to allocate the fullscreen triangle.");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const resolution = gl.getUniformLocation(program, "u_resolution");
  const time = gl.getUniformLocation(program, "u_time");
  const pointer = gl.getUniformLocation(program, "u_pointer");
  const pressure = gl.getUniformLocation(program, "u_strength");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const events = new AbortController();
  const listenerOptions = { passive: true, signal: events.signal };
  let frame = 0;
  let lastFrame = performance.now();
  let elapsed = 0;
  let rect = canvas.getBoundingClientRect();
  let px = -10;
  let py = -10;
  let targetX = -10;
  let targetY = -10;
  let vx = 0;
  let vy = 0;
  let strength = 0;
  let active = false;

  function draw() {
    gl.uniform1f(time, motion.matches ? 0 : elapsed);
    gl.uniform4f(pointer, px, py, motion.matches ? 0 : vx, motion.matches ? 0 : vy);
    gl.uniform1f(pressure, motion.matches ? 0 : strength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    surface.dataset.state = "ready";
  }

  function resize() {
    rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = Math.min(
      devicePixelRatio || 1,
      1.5,
      Math.sqrt(1_500_000 / (rect.width * rect.height)),
      2048 / Math.max(rect.width, rect.height),
    );
    canvas.width = Math.max(1, Math.floor(rect.width * scale));
    canvas.height = Math.max(1, Math.floor(rect.height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolution, canvas.width, canvas.height);
    if (!document.hidden) draw();
  }

  /** @param {number} now */
  function animate(now) {
    frame = requestAnimationFrame(animate);
    if (now - lastFrame < 1000 / 30) return;
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    elapsed += dt;
    // Small integration steps keep the damped spring stable at low frame rates.
    for (let remaining = dt; remaining > 0; remaining -= 1 / 120) {
      const step = Math.min(remaining, 1 / 120);
      vx += ((targetX - px) * 55 - vx * 10) * step;
      vy += ((targetY - py) * 55 - vy * 10) * step;
      px += vx * step;
      py += vy * step;
    }
    strength += ((active ? 1 : 0) - strength) * (1 - Math.exp(-dt * (active ? 8 : 2.5)));
    draw();
  }

  function updateMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = performance.now();
    if (document.hidden) {
      releasePointer();
      return;
    }
    if (motion.matches) {
      vx = vy = strength = 0;
      active = false;
      draw();
    } else {
      frame = requestAnimationFrame(animate);
    }
  }

  /** @param {PointerEvent} event */
  function movePointer(event) {
    if (motion.matches || document.hidden || !event.isPrimary) return;
    const size = Math.min(rect.width, rect.height);
    const x = (event.clientX - rect.left) / size;
    const y = (rect.bottom - event.clientY) / size;
    if (!active && strength < 0.01) {
      px = targetX = x;
      py = targetY = y;
      vx = vy = 0;
    }
    targetX = x;
    targetY = y;
    active = true;
  }

  function releasePointer() {
    active = false;
  }

  function stop() {
    cancelAnimationFrame(frame);
    events.abort();
    surface.dataset.state = "fallback";
  }

  window.addEventListener("pointermove", movePointer, listenerOptions);
  window.addEventListener("pointerdown", movePointer, listenerOptions);
  document.addEventListener("pointerleave", releasePointer, listenerOptions);
  window.addEventListener("pointercancel", releasePointer, listenerOptions);
  window.addEventListener("pointerup", event => {
    if (event.pointerType !== "mouse") releasePointer();
  }, listenerOptions);
  window.addEventListener("blur", releasePointer, listenerOptions);
  document.addEventListener("visibilitychange", updateMotion, listenerOptions);
  motion.addEventListener("change", updateMotion, listenerOptions);
  window.addEventListener("resize", resize, listenerOptions);
  canvas.addEventListener("webglcontextlost", stop, listenerOptions);
  window.addEventListener("pagehide", () => cancelAnimationFrame(frame), listenerOptions);
  window.addEventListener("pageshow", updateMotion, listenerOptions);
  resize();
  updateMotion();
}

try {
  start();
} catch (error) {
  surface.dataset.state = "fallback";
  console.error("Unable to start topography; using the static landscape.", error);
}
