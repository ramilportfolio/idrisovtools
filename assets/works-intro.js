(() => {
  "use strict";

  const paper = document.querySelector(".works-interlude");
  const smoke = document.querySelector(".works-smoke");
  const atmosphere = smoke.querySelector(".works-smoke__atmosphere");
  const title = smoke.querySelector(".works-smoke__title");
  const header = document.querySelector(".site-header");
  const { frameBudget, surfaceSize, smokeTexture } = window.SceneRendering;
  const budget = frameBudget();
  const desktop = matchMedia("(min-width: 821px) and (pointer: fine)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  };
  const mix = (from, to, t) => from + (to - from) * t;
  const canAnimate = () => desktop.matches && !reducedMotion.matches && !navigator.connection?.saveData && !(navigator.deviceMemory < 4);

  if (typeof CONFIG !== "undefined") paper.querySelector(".works-seal__name").textContent = CONFIG.name;
  if (typeof PROJECTS !== "undefined") {
    for (const card of paper.querySelectorAll(".works-interlude__card")) {
      const file = card.querySelector("img").getAttribute("src");
      const project = PROJECTS.find(item => item.localThumb === file);
      if (project) card.querySelector("figcaption").textContent = project.title;
    }
  }

  const vertexSource = `
    attribute vec2 position;
    varying vec2 uv;
    void main() {
      uv = position * .5 + .5;
      gl_Position = vec4(position, 0., 1.);
    }
  `;

  const fragmentSource = `
    precision highp float;
    varying vec2 uv;
    uniform float time;
    uniform float aspect;

    uniform sampler2D noiseMap;

    float clouds(vec2 p) {
      return texture2D(noiseMap, p * .125).r;
    }

    void main() {
      vec2 p = (uv - vec2(.5, .49)) * vec2(aspect, 1.);
      float t = time * .16;
      vec2 q = p * 3.45;
      q += vec2(clouds(q + vec2(t * .25, -t * .53)),
                clouds(q + vec2(3.6 - t * .33, t * .18))) * 2.05;
      float cloud = clouds(q + vec2(t * .27, -t * .44));
      float filament = clouds(q * 1.62 - vec2(t * .26, t * .31));
      float density = smoothstep(.23, .82, cloud * .69 + filament * .31);
      float center = exp(-dot(p * vec2(1.43, 1.92), p * vec2(1.43, 1.92)));
      float backlight = exp(-dot(p * vec2(3.4, 4.15), p * vec2(3.4, 4.15)));
      float wisps = smoothstep(.41, .76, density) * .46;
      float luminance = .021 + center * (.09 + density * .48 + wisps) +
                        backlight * (.07 + .25 * density);
      luminance += (texture2D(noiseMap, uv * 15.).r - .5) * .012;
      gl_FragColor = vec4(vec3(luminance * .993, luminance * .987, luminance * .977), 1.);
    }
  `;

  function makeAtmosphere(onLost) {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", {
      alpha: false, depth: false, antialias: false,
      powerPreference: "high-performance", failIfMajorPerformanceCaveat: true
    });
    if (!gl) return null;

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    const triangle = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.useProgram(program);
    const noiseMap = smokeTexture(gl, program);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const time = gl.getUniformLocation(program, "time");
    const aspect = gl.getUniformLocation(program, "aspect");
    atmosphere.append(canvas);
    canvas.addEventListener("webglcontextlost", onLost, { once: true });

    return {
      resize(width, height) {
        const [w, h] = surfaceSize(width, height, 510000, .8, budget.scale);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        gl.viewport(0, 0, w, h);
        gl.uniform1f(aspect, width / Math.max(height, 1));
      },
      draw(elapsed) {
        gl.uniform1f(time, elapsed);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      destroy() {
        canvas.removeEventListener("webglcontextlost", onLost);
        gl.deleteTexture(noiseMap);
        gl.deleteBuffer(triangle);
        gl.deleteProgram(program);
        canvas.remove();
      }
    };
  }

  function makeTitleParticles() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const mask = document.createElement("canvas");
    const stamp = mask.getContext("2d", { willReadFrequently: true });
    if (!ctx || !stamp) return null;
    canvas.className = "works-smoke__particles";
    canvas.setAttribute("aria-hidden", "true");
    smoke.append(canvas);

    const colors = ["#f2f0ea", "#fffaf3", "#c3c2c1", "#ffc89f"];
    let groups = colors.map(() => []);
    let width = 0;
    let height = 0;

    function resize(nextWidth, nextHeight) {
      const layoutChanged = width !== nextWidth || height !== nextHeight;
      width = nextWidth;
      height = nextHeight;
      const [w, h] = surfaceSize(width, height, 880000, Math.min(devicePixelRatio || 1, 1.5), budget.scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(w / width, 0, 0, h / height, 0, 0);
      if (!layoutChanged) return;

      const style = getComputedStyle(title);
      const fontSize = parseFloat(style.fontSize);
      const word = title.textContent.trim();
      const font = style.fontWeight + " " + style.fontSize + " " + style.fontFamily;
      const alignStamp = () => {
        stamp.font = font;
        if ("letterSpacing" in stamp) stamp.letterSpacing = style.letterSpacing;
        stamp.textAlign = "center";
        stamp.textBaseline = "alphabetic";
      };
      alignStamp();
      const metrics = stamp.measureText(word);
      mask.width = Math.ceil(metrics.width + fontSize * .28);
      mask.height = Math.ceil(fontSize * 1.25);
      alignStamp();
      const ascent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent;
      const descent = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent;
      stamp.fillStyle = "#fff";
      stamp.fillText(word, mask.width / 2, (mask.height + ascent - descent) / 2);
      const pixels = stamp.getImageData(0, 0, mask.width, mask.height).data;
      const step = Math.max(3, Math.round(fontSize / 59));
      groups = colors.map(() => []);
      let seed = 72461;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      for (let y = 0; y < mask.height; y += step) {
        for (let x = 0; x < mask.width; x += step) {
          if (pixels[(y * mask.width + x) * 4 + 3] < 105) continue;
          const tx = (width - mask.width) / 2 + x + (random() - .5) * 2;
          const ty = (height - mask.height) / 2 + y + (random() - .5) * 2;
          const angle = random() * Math.PI * 2;
          const distance = .07 + random() * .46;
          const side = tx < width / 2 ? -1 : 1;
          const startX = width / 2 + Math.cos(angle) * width * distance;
          const startY = height / 2 + Math.sin(angle) * height * distance;
          const group = random() < .055 ? 3 : Math.floor(random() * 3);
          groups[group].push({
            tx, ty, startX, startY,
            endX: tx + side * width * (.08 + random() * .29),
            endY: ty + Math.sin(angle) * height * (.10 + random() * .26),
            phase: random() * 7,
            drift: (random() - .5) * 46,
            delay: random() * .055,
            size: .65 + random() * 1.55,
            brightness: .37 + random() * .63
          });
        }
      }
    }

    function draw(progress, settled) {
      ctx.clearRect(0, 0, width, height);
      const appearing = smooth((progress - .172) / .103) * (1 - settled * .99);
      const dispersing = smooth((progress - .56) / .115) * (1 - smooth((progress - .745) / .19));
      const opacity = Math.max(appearing, dispersing * .87);
      if (opacity < .015) return;

      for (let group = 0; group < groups.length; group++) {
        ctx.fillStyle = colors[group];
        for (const particle of groups[group]) {
          const settle = smooth((progress - .15 - particle.delay) / .19);
          const fly = smooth((progress - .571 - particle.delay * .73) / .294);
          const arc = Math.sin(settle * Math.PI) * Math.sin(particle.phase);
          const x = mix(mix(particle.startX, particle.tx, settle), particle.endX, fly) + arc * particle.drift;
          const y = mix(mix(particle.startY, particle.ty, settle), particle.endY, fly) - arc * particle.drift * .65;
          ctx.globalAlpha = opacity * particle.brightness * (1 - fly * .62);
          ctx.fillRect(x, y, particle.size * (1 + fly * .74), particle.size);
        }
      }
    }

    return { resize, draw, destroy: () => canvas.remove() };
  }

  let paperVisible = false;
  let smokeVisible = false;
  let requested = 0;
  let dirty = true;
  let needsResize = true;
  let triedSmoke = false;
  let smokeRenderer;
  let particles;
  let triedParticles = false;
  let fontReady = false;
  let loadingFont = false;
  let previousSmokeFrame = 0;
  let smokeTime = 0;
  let shakeStart = null;
  let lastProgress = -1;
  let paperProgressCurrent = null;
  let previousPaperFrame = 0;
  let smokeProgressCurrent = null;
  let smokeProgressTarget = 0;

  function removeSmoke() {
    smokeRenderer?.destroy();
    particles?.destroy();
    smokeRenderer = undefined;
    particles = undefined;
    triedParticles = false;
    needsResize = true;
    lastProgress = -1;
    smokeProgressCurrent = null;
    shakeStart = null;
    previousSmokeFrame = 0;
    smoke.classList.remove("is-live");
    for (const property of ["--works-flash", "--works-title-opacity", "--works-title-x", "--works-title-y"]) {
      smoke.style.removeProperty(property);
    }
  }

  function beginSmoke() {
    if (!triedSmoke) {
      triedSmoke = true;
      try {
        smokeRenderer = makeAtmosphere(removeSmoke);
      } catch {
        return;
      }
    }
    if (!smokeRenderer || fontReady || loadingFont) return;
    loadingFont = true;
    const style = getComputedStyle(title);
    document.fonts.load(style.fontWeight + " " + style.fontSize + ' "Cormorant Garamond"', title.textContent)
      .catch(() => [])
      .then(() => {
        fontReady = true;
        loadingFont = false;
        requestUpdate();
      });
  }

  function progressOf(bounds) {
    const viewport = document.documentElement.clientHeight;
    const readingHeight = viewport - header.offsetHeight;
    return clamp((viewport - bounds.top) / (readingHeight + bounds.height));
  }

  function movePaper(now) {
    const box = paper.getBoundingClientRect();
    const target = progressOf(box);
    if (paperProgressCurrent === null || !previousPaperFrame) {
      paperProgressCurrent = target;
    } else {
      const dt = Math.min(.05, Math.max(0, (now - previousPaperFrame) / 1000));
      paperProgressCurrent += (target - paperProgressCurrent) * (1 - Math.exp(-16 * dt));
    }
    previousPaperFrame = now;
    const progress = paperProgressCurrent;
    paper.style.setProperty("--works-word-y", ((.49 - progress) * box.height * 1.62).toFixed(2) + "px");
    paper.style.setProperty("--works-seal-y", ((.50 - progress) * 95).toFixed(2) + "px");
    paper.style.setProperty("--works-drift", ((.50 - progress) * 170).toFixed(2) + "px");
    paper.style.setProperty("--works-card-x", ((1 - smooth((progress - .08) / .39)) * (box.width * .23)).toFixed(2) + "px");
    return Math.abs(target - progress) > .0002;
  }

  function animateTitle(now, progress) {
    const settled = smooth((progress - .391) / .112);
    const titleOpacity = settled * (1 - smooth((progress - .683) / .177));
    const flash = smooth((progress - .16) / .14) * (1 - smooth((progress - .287) / .132));
    if (Math.abs(progress - lastProgress) > .00001 || lastProgress === -1) {
      lastProgress = progress;
      smoke.style.setProperty("--works-flash", String(.045 + flash * .79));
      smoke.style.setProperty("--works-title-opacity", String(titleOpacity));
      particles.draw(progress, settled);
    }

    const shaking = progress >= .429 && progress < .58;
    if (shaking && shakeStart === null) shakeStart = now;
    if (!shaking) shakeStart = null;
    const vibration = shakeStart === null ? 0 : 1.45 * (1 - smooth((now - shakeStart) / 590));
    smoke.style.setProperty("--works-title-x", (vibration * Math.sin(now * .054)).toFixed(2) + "px");
    smoke.style.setProperty("--works-title-y", (vibration * Math.sin(now * .079) * .56).toFixed(2) + "px");
  }

  function paint(now) {
    requested = 0;
    const started = performance.now();
    if (!canAnimate()) {
      updatePlayback();
      return;
    }
    if (document.hidden) return;

    const paperSettling = paperVisible ? movePaper(now) : false;
    if (smokeVisible) {
      beginSmoke();
      if (smokeRenderer) {
        if (!triedParticles && fontReady) {
          triedParticles = true;
          particles = makeTitleParticles();
          needsResize = true;
        }

        const box = (dirty || needsResize || smokeProgressCurrent === null) ? smoke.getBoundingClientRect() : null;
        if (needsResize && box) {
          smokeRenderer.resize(box.width, box.height);
          particles?.resize(box.width, box.height);
          lastProgress = -1;
          needsResize = false;
        }
        const interval = previousSmokeFrame ? Math.max(0, now - previousSmokeFrame) : 0;
        const dt = Math.min(.05, interval / 1000);
        smokeTime += dt;
        previousSmokeFrame = now;
        smokeRenderer.draw(smokeTime);
        if (!smoke.classList.contains("is-live")) smoke.classList.add("is-live");
        if (particles) {
          if (box) smokeProgressTarget = progressOf(box);
          if (smokeProgressCurrent === null || !dt) {
            smokeProgressCurrent = smokeProgressTarget;
          } else {
            smokeProgressCurrent += (smokeProgressTarget - smokeProgressCurrent) * (1 - Math.exp(-18 * dt));
          }
          if (Math.abs(smokeProgressTarget - smokeProgressCurrent) < .00015) smokeProgressCurrent = smokeProgressTarget;
          animateTitle(now, smokeProgressCurrent);
        }
        if (budget.sample(interval, performance.now() - started)) needsResize = true;
        requested = requestAnimationFrame(paint);
      } else if (paperSettling) {
        requested = requestAnimationFrame(paint);
      }
    } else if (paperSettling) {
      requested = requestAnimationFrame(paint);
    }
    dirty = false;
  }

  function requestUpdate() {
    dirty = true;
    if (!requested && (paperVisible || smokeVisible) && canAnimate() && !document.hidden) {
      requested = requestAnimationFrame(paint);
    }
  }

  function updatePlayback() {
    const enabled = canAnimate();
    paper.classList.toggle("is-in-view", paperVisible && enabled && !document.hidden);
    if (!smokeVisible || !enabled || document.hidden) {
      previousSmokeFrame = 0;
      budget.reset();
      smokeProgressCurrent = null;
    }
    if (!paperVisible || !enabled || document.hidden) {
      previousPaperFrame = 0;
      paperProgressCurrent = null;
    }
    if ((!paperVisible && !smokeVisible) || !enabled || document.hidden) {
      cancelAnimationFrame(requested);
      requested = 0;
    }
    if (!enabled) {
      for (const property of ["--works-word-y", "--works-seal-y", "--works-drift", "--works-card-x"]) {
        paper.style.removeProperty(property);
      }
      removeSmoke();
      triedSmoke = false;
    }
    requestUpdate();
  }

  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const shown = entry.isIntersecting && entry.intersectionRatio >= .035;
      if (entry.target === paper) paperVisible = shown;
      else smokeVisible = shown;
    }
    updatePlayback();
  }, { threshold: .035, rootMargin: "-74px 0px 0px" });

  visibility.observe(paper);
  visibility.observe(smoke);
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", () => {
    needsResize = true;
    requestUpdate();
  });
  document.addEventListener("visibilitychange", updatePlayback);
  desktop.addEventListener("change", updatePlayback);
  reducedMotion.addEventListener("change", updatePlayback);
})();
