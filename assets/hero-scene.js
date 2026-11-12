(() => {
  "use strict";

  const screen = document.querySelector(".hero-screen");
  const atmosphere = screen.querySelector(".hero-atmosphere");
  const film = screen.querySelector(".hero-film");
  const motion = matchMedia("(min-width: 821px) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  const pinMotion = matchMedia("(min-width: 1024px) and (min-height: 720px) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  const assetRoot = new URL("./", document.currentScript.src);
  const { frameBudget, surfaceSize, smokeTexture } = window.SceneRendering;
  const budget = frameBudget();
  const pointer = { x: 0, y: 0 };
  let pendingPointer;
  const target = { x: 0, y: 0 };
  let smoke;
  let ribbon;
  let scrollSequence;
  let scrollRequested = false;
  let scrollModules;
  let visible = false;
  let frame = 0;
  let resizeForBudget = false;
  let previous = null;
  let time = 0;

  function loadScript(name) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = new URL(name, assetRoot).href;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  const smokeVertex = `
    attribute vec2 position;
    varying vec2 uv;
    void main() {
      uv = position * .5 + .5;
      gl_Position = vec4(position, 0., 1.);
    }
  `;

  const smokeFragment = `
    precision highp float;
    varying vec2 uv;
    uniform float time;
    uniform float aspect;
    uniform vec2 cursor;

    uniform sampler2D noiseMap;

    float smokeField(vec2 p) {
      return texture2D(noiseMap, p * .125).r;
    }

    void main() {
      vec2 p = uv - cursor * vec2(.013, .021);
      vec2 field = p * vec2(aspect * 3.25, 3.25);
      float t = time * .11;
      vec2 warp = vec2(smokeField(field + vec2(-t, t * .29)),
                       smokeField(field + vec2(7.6, 4.1 - t * .62)));
      vec2 drift = field + (warp - .45) * 2.6;
      float clouds = smokeField(drift * 1.3 + vec2(t * .46, -t * .32));
      float ribbons = smokeField(drift * 2.1 + vec2(t * .55, t * .34));
      float texture = smoothstep(.24, .83, clouds * .76 + ribbons * .24);
      float center = exp(-dot((p - vec2(.68, .53)) * vec2(2.55, 1.8),
                              (p - vec2(.68, .53)) * vec2(2.55, 1.8)));
      vec2 hotspot = (p - vec2(.88, .89)) * vec2(4.9, 2.6);
      float heat = exp(-dot(hotspot, hotspot));
      vec3 color = vec3(.047, .018, .028);
      color += vec3(.94, .045, .026) * center * (.22 + .92 * texture);
      color += vec3(.72, .16, .028) * heat * (.32 + texture * 1.33);
      color += vec3(.26, .09, .018) * heat * smoothstep(.42, .77, ribbons);
      color = mix(color, vec3(.063, .027, .031), 1. - clamp(uv.y / .3, 0., 1.));
      color = mix(color, vec3(.063, .027, .037), .95 * (1. - smoothstep(.20, .74, uv.x)));
      gl_FragColor = vec4(color, 1.);
    }
  `;

  function createSmoke() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "high-performance", failIfMajorPerformanceCaveat: true });
    if (!gl) return null;

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }

    const program = gl.createProgram();
    const vertex = compile(gl.VERTEX_SHADER, smokeVertex);
    const fragment = compile(gl.FRAGMENT_SHADER, smokeFragment);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    gl.useProgram(program);
    smokeTexture(gl, program);

    const triangle = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = {
      time: gl.getUniformLocation(program, "time"),
      aspect: gl.getUniformLocation(program, "aspect"),
      cursor: gl.getUniformLocation(program, "cursor")
    };

    atmosphere.append(canvas);
    let width = 0;
    let height = 0;
    let lost = false;
    function sizeCanvas() {
      if (!width || !height || lost) return;
      const [w, h] = surfaceSize(width, height, 475000, .75, budget.scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform1f(uniforms.aspect, width / height);
    }
    const resize = new ResizeObserver(([entry]) => {
      ({ width, height } = entry.contentRect);
      sizeCanvas();
    });
    resize.observe(atmosphere);
    canvas.addEventListener("webglcontextlost", () => {
      lost = true;
      resize.disconnect();
      atmosphere.classList.remove("is-live");
      smoke = null;
      updatePlayback();
    }, { once: true });

    return {
      resize: sizeCanvas,
      draw(elapsed) {
        if (lost || !width || !height) return;
        gl.uniform1f(uniforms.time, elapsed);
        gl.uniform2f(uniforms.cursor, pointer.x, -pointer.y);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      setVisible(active) {
        atmosphere.classList.toggle("is-live", active && !lost);
      }
    };
  }

  function mobiusGeometry(three) {
    const rings = 240;
    const columns = 12;
    const uvs = [];
    const faces = [];
    for (let ring = 0; ring <= rings; ring++) {
      for (let column = 0; column <= columns; column++) {
        uvs.push(ring / rings, column / columns);
        if (ring < rings && column < columns) {
          const point = ring * (columns + 1) + column;
          const next = point + columns + 1;
          faces.push(point, next, point + 1, next, next + 1, point + 1);
        }
      }
    }

    const geometry = new three.BufferGeometry();
    geometry.setAttribute("position", new three.BufferAttribute(new Float32Array(uvs.length * 1.5), 3));
    geometry.setAttribute("uv", new three.BufferAttribute(new Float32Array(uvs), 2));
    geometry.setIndex(faces);

    return geometry;
  }

  // The shader deforms the mesh. Only projected particle origins use this CPU copy.
  function sampleBandEdge(target, angle, side, coil) {
    const roll = Math.sin(angle + .7) * 1.64 + Math.sin(angle * 2 - .3) * .31;
    const twist = angle * .5 - .42 + roll * coil;
    const center = 1.84 - coil * (.24 + .18 * Math.sin(angle * 3 + .9));
    const offset = (side - .5) * (1.14 - .15 * coil);
    const radius = center + offset * Math.cos(twist);
    const depth = Math.sin(angle * 2 + .3) * (.22 + .53 * coil) + offset * Math.sin(twist);
    return target.set(radius * Math.cos(angle) * 1.1, radius * Math.sin(angle) * .92, depth);
  }

  function smoothPhase(value) {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
  }

  const ribbonVertex = `
    uniform float coil;
    varying vec2 texCoord;
    varying vec3 surfaceNormal;
    varying vec3 towardCamera;

    vec3 bandPoint(vec2 st) {
      float angle = st.x * 6.28318530718;
      float roll = sin(angle + .7) * 1.64 + sin(angle * 2. - .3) * .31;
      float twist = angle * .5 - .42 + roll * coil;
      float center = 1.84 - coil * (.24 + .18 * sin(angle * 3. + .9));
      float offset = (st.y - .5) * (1.14 - .15 * coil);
      float radius = center + offset * cos(twist);
      float depth = sin(angle * 2. + .3) * (.22 + .53 * coil) + offset * sin(twist);
      return vec3(radius * cos(angle) * 1.1, radius * sin(angle) * .92, depth);
    }

    void main() {
      texCoord = uv;
      vec3 pointOnBand = bandPoint(uv);
      vec3 tangent = bandPoint(uv + vec2(.001, 0.)) - pointOnBand;
      vec3 across = bandPoint(uv + vec2(0., .02)) - pointOnBand;
      surfaceNormal = normalize(normalMatrix * cross(tangent, across));
      vec4 point = modelViewMatrix * vec4(pointOnBand, 1.0);
      towardCamera = -point.xyz;
      gl_Position = projectionMatrix * point;
    }
  `;

  const ribbonFragment = `
    uniform sampler2D atlas;
    uniform float dissolve;
    varying vec2 texCoord;
    varying vec3 surfaceNormal;
    varying vec3 towardCamera;

    float filmHash(vec2 p) {
      p = fract(p * vec2(.1031, .11369));
      p += dot(p, p.yx + 19.19);
      return fract((p.x + p.y) * p.x);
    }

    float filmNoise(vec2 p) {
      vec2 cell = floor(p);
      vec2 f = fract(p);
      f = f * f * (3. - 2. * f);
      return mix(mix(filmHash(cell), filmHash(cell + vec2(1., 0.)), f.x),
                 mix(filmHash(cell + vec2(0., 1.)), filmHash(cell + 1.), f.x), f.y);
    }

    void main() {
      vec4 frame = texture2D(atlas, texCoord);
      if (frame.a < .42) discard;
      float border = min(texCoord.y, 1. - texCoord.y);
      float hotEdge = 0.;
      if (dissolve > 0.) {
        float resistance = .035 + border * .76
          + filmNoise(texCoord * vec2(85., 16.)) * .27
          + filmNoise(texCoord * vec2(324., 60.)) * .11;
        if (resistance < dissolve) discard;
        hotEdge = 1. - smoothstep(.006, .033, resistance - dissolve);
      }

      vec3 n = normalize(surfaceNormal) * (gl_FrontFacing ? 1. : -1.);
      vec3 v = normalize(towardCamera);
      vec3 reflection = reflect(-v, n);
      float metal = 1. - smoothstep(.145, .19, border);
      float bevel = 1. - smoothstep(.004, .021, border);
      float rim = pow(1. - max(dot(n, v), 0.), 2.3);
      float strip = pow(max(dot(reflection, normalize(vec3(-.45, .72, .6))), 0.), 16.);
      float strip2 = pow(max(dot(reflection, normalize(vec3(.48, -.62, .62))), 0.), 10.);
      float glow = pow(max(dot(reflection, normalize(vec3(.66, .28, -.6))), 0.), 4.);
      float softbox = .44 + .31 * max(dot(n, normalize(vec3(-.4, .72, .56))), 0.);

      vec3 photo = frame.rgb * (softbox + .17) + vec3(.058, .033, .032) * rim;
      vec3 chrome = frame.rgb * (softbox + .05) +
        vec3(.95, .93, .93) * (.59 * strip + .43 * strip2 + .24 * bevel) +
        vec3(.91, .17, .06) * (glow * .59 + rim * .19);
      gl_FragColor = vec4(mix(photo, chrome, metal) + hotEdge * vec3(.91, .075, .015), 1.);
      #include <colorspace_fragment>
    }
  `;

  async function createRibbon() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", { alpha: true, antialias: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: true });
    if (!context) return null;
    if (pinMotion.matches) loadScrollModules();
    await Promise.all([loadScript("three-hero.min.js"), loadScript("film-frames.js")]);
    if (!motion.matches) return null;
    const atlasImage = new Image();
    atlasImage.src = globalThis.heroFilmAtlas;
    await atlasImage.decode();
    const three = globalThis.HeroThree;
    const texture = new three.Texture(atlasImage);
    texture.colorSpace = three.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;

    const renderer = new three.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
    renderer.setClearColor(0, 0);
    const scene = new three.Scene();
    const camera = new three.PerspectiveCamera(34, 1, .1, 40);
    const coilAmount = { value: 0 };
    const dissolve = { value: 0 };
    const ribbonMesh = new three.Mesh(mobiusGeometry(three), new three.ShaderMaterial({
      vertexShader: ribbonVertex,
      fragmentShader: ribbonFragment,
      uniforms: { atlas: { value: texture }, dissolve, coil: coilAmount },
      side: three.DoubleSide
    }));
    ribbonMesh.frustumCulled = false;
    scene.add(ribbonMesh);
    film.append(canvas);

    let lost = false;
    let resized = true;
    let width = 0;
    let height = 0;
    function sizeCanvas() {
      if (!width || !height || lost) return;
      const [w, h] = surfaceSize(width, height, 1350000, Math.min(devicePixelRatio || 1, 2), budget.scale);
      if (canvas.width !== w || canvas.height !== h) {
        renderer.setSize(w, h, false);
        resized = true;
      }
    }
    const resize = new ResizeObserver(([entry]) => {
      ({ width, height } = entry.contentRect);
      if (!width || !height || lost) return;
      resized = true;
      camera.aspect = width / height;
      camera.position.z = Math.max(8.3, 8.9 / camera.aspect);
      camera.updateProjectionMatrix();
      sizeCanvas();
    });
    resize.observe(film);
    canvas.addEventListener("webglcontextlost", () => {
      lost = true;
      resize.disconnect();
      film.classList.remove("is-live");
      ribbon = null;
      scrollSequence?.destroy();
      scrollSequence = undefined;
      updatePlayback();
    }, { once: true });

    let elapsedBefore = 0;
    let idleTurn = 0;
    let lastProgress = -1;
    let lastTurn = -1;
    let lastX = 0;
    let lastY = 0;
    const edge = ribbonMesh.position.clone();

    return {
      resize: sizeCanvas,
      draw(elapsed, progress) {
        if (lost) return;
        idleTurn += (elapsed - elapsedBefore) * (1 - smoothPhase(progress / .25));
        elapsedBefore = elapsed;
        const threshold = Math.min(1, Math.max(0, (progress - .205) / .61)) * .83;
        if (!resized && ((threshold === .83 && dissolve.value === .83) ||
            (Math.abs(lastProgress - progress) < .00001 && Math.abs(lastTurn - idleTurn) < .0002 &&
             Math.abs(lastX - pointer.x) + Math.abs(lastY - pointer.y) < .0001))) return false;
        resized = false;
        lastProgress = progress;
        lastTurn = idleTurn;
        lastX = pointer.x;
        lastY = pointer.y;
        const coil = smoothPhase((progress - .018) / .72);
        coilAmount.value = coil;
        const phase = idleTurn * .23;
        ribbonMesh.rotation.set(
          .35 + .22 * Math.sin(phase) + coil * .77 + pointer.y * .22,
          -.44 + idleTurn * .17 + coil * 1.48 + pointer.x * .26,
          -.27 + .19 * Math.sin(phase * .54) - coil * .50
        );
        ribbonMesh.position.set(coil * .26, -coil * .11, 0);
        dissolve.value = threshold;
        renderer.render(scene, camera);
        return true;
      },
      projectEdges(output) {
        if (lost) return;
        const samples = output.length / 4;
        for (let sample = 0; sample < samples; sample++) {
          const angle = sample / samples * Math.PI * 2;
          for (let side = 0; side < 2; side++) {
            sampleBandEdge(edge, angle, side, coilAmount.value).applyMatrix4(ribbonMesh.matrixWorld).project(camera);
            const index = (sample * 2 + side) * 2;
            output[index] = edge.x * .5 + .5;
            output[index + 1] = .5 - edge.y * .5;
          }
        }
      },
      setVisible(active) {
        film.classList.toggle("is-live", active && !lost);
      }
    };
  }

  function render(now) {
    if (!visible || document.hidden || !motion.matches) {
      frame = 0;
      return;
    }
    const started = performance.now();
    if (resizeForBudget) {
      smoke?.resize();
      ribbon?.resize();
      scrollSequence?.resizeDust();
      resizeForBudget = false;
    }
    const interval = previous === null ? 0 : Math.max(0, now - previous);
    const delta = Math.min(interval / 1000, .05);
    previous = now;
    time += delta;
    if (pendingPointer) {
      const rect = screen.getBoundingClientRect();
      target.x = (pendingPointer.x - rect.left) / rect.width * 2 - 1;
      target.y = (pendingPointer.y - rect.top) / rect.height * 2 - 1;
      pendingPointer = undefined;
    }
    const smoothing = 1 - Math.exp(-8 * delta);
    pointer.x += (target.x - pointer.x) * smoothing;
    pointer.y += (target.y - pointer.y) * smoothing;
    const progress = scrollSequence?.progress ?? 0;
    if (progress < .98) smoke?.draw(time);
    const moved = ribbon?.draw(time, progress);
    if (ribbon) scrollSequence?.drawDust(ribbon, moved);
    resizeForBudget = budget.sample(interval, performance.now() - started);
    frame = requestAnimationFrame(render);
  }

  function loadScrollModules() {
    scrollModules ??= Promise.all([loadScript("scroll-vendor.min.js"), loadScript("hero-scroll.js")])
      .then(() => true)
      .catch(() => false);
    return scrollModules;
  }

  function startScrollSequence() {
    if (!ribbon || !visible || !pinMotion.matches || scrollRequested) return;
    scrollRequested = true;
    loadScrollModules()
      .then(loaded => {
        if (loaded && ribbon) scrollSequence = globalThis.createHeroScroll(screen, film, pinMotion, budget);
      })
      .catch(() => {
        // Native scrolling remains available when optional animation files fail.
      });
  }

  pinMotion.addEventListener("change", startScrollSequence);

  function updatePlayback() {
    const canRender = visible && !document.hidden && motion.matches && Boolean(smoke || ribbon);
    smoke?.setVisible(motion.matches);
    ribbon?.setVisible(motion.matches);
    if (canRender && !frame) {
      previous = null;
      budget.reset();
      frame = requestAnimationFrame(render);
    } else if (!canRender && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  screen.addEventListener("pointermove", event => {
    if (!motion.matches || event.pointerType !== "mouse") return;
    pendingPointer = { x: event.clientX, y: event.clientY };
  }, { passive: true });

  screen.addEventListener("pointerleave", () => {
    pendingPointer = undefined;
    target.x = 0;
    target.y = 0;
  });

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    startScrollSequence();
    updatePlayback();
  });
  observer.observe(screen);
  motion.addEventListener("change", updatePlayback);
  document.addEventListener("visibilitychange", updatePlayback);
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(frame);
    frame = 0;
  });
  window.addEventListener("pageshow", updatePlayback);

  try {
    smoke = createSmoke();
  } catch {
    // The CSS atmosphere is already painted when WebGL is unavailable.
  }
  updatePlayback();

  createRibbon().then(view => {
    ribbon = view;
    startScrollSequence();
    updatePlayback();
  }).catch(() => {
    // Keep the poster when the renderer or its optional assets cannot load.
  });
})();
