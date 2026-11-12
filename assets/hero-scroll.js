(() => {
  "use strict";

  const clamp = value => Math.min(1, Math.max(0, value));
  const smooth = value => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  };

  function makeDust(screen, film, budget) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return null;
    canvas.className = "hero-dust";
    canvas.setAttribute("aria-hidden", "true");
    screen.append(canvas);

    const samples = 96;
    const origins = new Float32Array(samples * 4);
    const splashes = [.55, .68, .80, .89, .965];
    const colors = ["#ff3019", "#ff5d3c", "#ed1a22", "#f04729", "#ffd39b"];
    const groups = colors.map(() => []);
    let seed = 52193;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    // Each speck has a fixed birth and landing point so the effect reverses on scroll.
    for (let index = 0; index < 1700; index++) {
      const spark = random() < .08;
      const cluster = splashes[Math.floor(random() * splashes.length)];
      const spread = (random() + random() - 1) * .105;
      const group = spark ? groups[4] : groups[Math.floor(random() * 4)];
      group.push({
        origin: Math.floor(random() * samples * 2) * 2,
        birth: .213 + random() ** 1.28 * .53,
        speed: 1 / (.12 + random() * .205),
        spread: .035 + random() * .18,
        curl: (random() - .5) * .18,
        landX: cluster + spread,
        landY: .991 - random() ** 2.7 * (.035 + .051 * (1 - Math.abs(spread) * 9)),
        radius: spark ? .7 + random() * 1.35 : .34 + random() ** 2 * 2,
        opacity: .23 + random() * .72,
        spark
      });
    }

    let width = 0;
    let height = 0;
    let filmX = 0;
    let clipLeft = 0;
    let filmY = 0;
    let filmWidth = 0;
    let filmHeight = 0;
    let painted = false;
    let previousProgress = -1;

    function size() {
      const screenBounds = screen.getBoundingClientRect();
      const filmBounds = film.getBoundingClientRect();
      width = screen.clientWidth;
      height = screen.clientHeight;
      filmX = filmBounds.left - screenBounds.left;
      filmY = filmBounds.top - screenBounds.top;
      filmWidth = filmBounds.width;
      filmHeight = filmBounds.height;
      clipLeft = Math.max(0, Math.floor(Math.min(filmX - 48, width * .43)));
      const coverage = width - clipLeft;
      if (!coverage || !height) return;
      const [w, h] = window.SceneRendering.surfaceSize(coverage, height, 960000, Math.min(devicePixelRatio || 1, 1.5), budget.scale);
      canvas.style.left = clipLeft + "px";
      canvas.style.width = coverage + "px";
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        painted = false;
      }
      ctx.setTransform(w / coverage, 0, 0, h / height, -clipLeft * w / coverage, 0);
      previousProgress = -1;
    }

    function clear() {
      if (!painted) return;
      ctx.clearRect(clipLeft, 0, width - clipLeft, height);
      painted = false;
    }

    const resize = new ResizeObserver(size);
    resize.observe(screen);
    resize.observe(film);
    size();

    return {
      resize: size,
      draw(ribbon, progress, moved) {
        if (painted && !moved && Math.abs(progress - previousProgress) < .00001) return;
        previousProgress = progress;
        clear();
        if (progress < .213 || progress >= .995 || !width || !height) return;
        if (moved || progress < .82) ribbon.projectEdges(origins);
        const wash = 1 - smooth((progress - .93) / .065);
        for (let group = 0; group < groups.length; group++) {
          ctx.fillStyle = colors[group];
          for (const particle of groups[group]) {
            if (particle.birth >= progress) continue;
            const t = clamp((progress - particle.birth) * particle.speed);
            const rest = 1 - t;
            const launch = 3 * t * rest * rest;
            const fall = 3 * t * t * rest;
            const landed = t * t * t;
            const start = rest * rest * rest;
            const sx = filmX + origins[particle.origin] * filmWidth;
            const sy = filmY + origins[particle.origin + 1] * filmHeight;
            const endX = particle.landX * width;
            const endY = particle.landY * height;
            const sway = Math.sin(t * Math.PI) * particle.curl;
            const x = start * sx + launch * (sx + width * particle.spread) +
              fall * (endX + width * sway * .4) + landed * endX;
            const y = start * sy + launch * (sy + height * particle.curl) +
              fall * (endY - height * (.14 + Math.abs(sway))) + landed * endY;
            const radius = particle.radius * (1 - t * .24);
            ctx.globalAlpha = Math.min(1, t * 15) * particle.opacity * wash * (1 - t * .29);
            if (particle.spark && t < .88) {
              ctx.fillRect(x - radius, y - radius / 2, radius * 3.6, radius);
            } else if (radius < 1.25) {
              ctx.fillRect(x, y, radius * 1.6, radius * 1.6);
            } else {
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        painted = true;
      },
      destroy() {
        resize.disconnect();
        canvas.remove();
      }
    };
  }

  globalThis.createHeroScroll = function (screen, film, motion, budget) {
    const { gsap, ScrollTrigger, Lenis } = globalThis;
    if (!gsap || !ScrollTrigger || !Lenis) return;
    gsap.registerPlugin(ScrollTrigger);
    const stage = screen.closest(".hero-pin");
    const profile = stage.nextElementSibling;
    const header = document.querySelector(".site-header");
    const cracks = screen.querySelector(".hero-exit__cracks");
    const cream = screen.querySelector(".hero-exit__cream");
    const flash = screen.querySelector(".hero-exit__flash");
    const scrollState = { value: 0 };
    const events = new AbortController();
    const listener = { signal: events.signal };
    let tween;
    let lenis;
    let dust;
    let pulse;
    let flashReady = true;

    const frameHeight = () => document.documentElement.clientHeight - header.offsetHeight;
    const fits = () => screen.offsetHeight <= frameHeight() + 3;

    function paintExit() {
      const progress = scrollState.value;
      const opening = smooth((progress - .79) / .137);
      const flare = smooth((progress - .793) / .043) * (1 - smooth((progress - .947) / .052));
      const bleaching = smooth((progress - .905) / .092);
      cracks.style.setProperty("--crack-offset", String(1 - opening));
      cracks.style.opacity = String(flare);
      cream.style.opacity = String(bleaching);
      screen.classList.toggle("is-bleached", bleaching > .72);
      if (progress >= .945 && flashReady) {
        flashReady = false;
        const trigger = tween?.scrollTrigger;
        if (trigger?.direction > 0 && scrollY < trigger.end + 56 && !document.hidden) {
          pulse?.cancel();
          pulse = flash.animate([{ opacity: .86 }, { opacity: 0 }], {
            duration: 300,
            easing: "cubic-bezier(.2,.65,.37,1)"
          });
        }
      } else if (progress < .85) {
        flashReady = true;
      }
    }

    function smoothWheel(time) {
      if (!document.hidden && (lenis.isScrolling === "smooth" || scrollY < tween.scrollTrigger.end + 12)) {
        lenis.raf(time * 1000);
      }
    }

    function activate() {
      if (tween || !motion.matches || !fits() || document.hidden || scrollY > 110) return;
      dust = makeDust(screen, film, budget);
      tween = gsap.to(scrollState, {
        value: 1,
        ease: "none",
        onUpdate: paintExit,
        scrollTrigger: {
          id: "hero-exit",
          trigger: stage,
          start: () => "top top+=" + header.offsetHeight,
          end: () => "+=" + Math.round(frameHeight() * 2.08),
          pin: screen,
          pinSpacing: true,
          scrub: .18,
          invalidateOnRefresh: true
        }
      });

      lenis = new Lenis({
        lerp: .14,
        autoRaf: false,
        stopInertiaOnNavigate: true,
        prevent: element => element instanceof Element &&
          Boolean(element.closest(".modal-backdrop, .nav-links, input, textarea, select, [contenteditable]")),
        virtualScroll: ({ event, deltaY }) => {
          const end = tween?.scrollTrigger.end;
          if (event.type !== "wheel" || !end || event.ctrlKey || document.hidden) return false;
          return scrollY < end + 2 || (deltaY < 0 && scrollY < end + 130);
        }
      });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(smoothWheel);
    }

    function deactivate() {
      if (!tween) return;
      const scrollBefore = scrollY;
      const profileBefore = profile.getBoundingClientRect().top;
      const pinStart = tween.scrollTrigger.start;
      const pinEnd = tween.scrollTrigger.end;
      gsap.ticker.remove(smoothWheel);
      lenis.destroy();
      lenis = undefined;
      tween.scrollTrigger.kill(true);
      tween.kill();
      tween = undefined;
      pulse?.cancel();
      dust?.destroy();
      dust = undefined;
      scrollState.value = 0;
      paintExit();

      // Keep downstream content in view when the pin spacing is removed.
      if (scrollBefore >= pinEnd) {
        window.scrollBy({ top: profile.getBoundingClientRect().top - profileBefore, behavior: "instant" });
      } else if (scrollBefore > pinStart) {
        window.scrollTo({ top: Math.max(0, pinStart), behavior: "instant" });
      }
    }

    function checkLayout() {
      if (!motion.matches || !fits()) deactivate();
      else activate();
    }

    function stopInertia() {
      if (lenis?.isScrolling === "smooth") {
        lenis.scrollTo(scrollY, { immediate: true, force: true });
      }
    }

    document.addEventListener("click", event => {
      if (event.target instanceof Element && event.target.closest('a[href^="#"]') &&
          !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) stopInertia();
    }, { ...listener, capture: true });
    document.addEventListener("keydown", event => {
      if (/^(?:ArrowUp|ArrowDown|PageUp|PageDown|Home|End|Tab| )$/.test(event.key)) stopInertia();
    }, { ...listener, capture: true });

    window.addEventListener("scroll", activate, { ...listener, passive: true });
    window.addEventListener("resize", checkLayout, listener);
    document.addEventListener("visibilitychange", checkLayout, listener);
    motion.addEventListener("change", checkLayout, listener);
    const layout = new ResizeObserver(checkLayout);
    layout.observe(header);
    layout.observe(screen);
    activate();

    return {
      get progress() {
        return scrollState.value;
      },
      resizeDust() {
        dust?.resize();
      },
      drawDust(ribbon, moved) {
        dust?.draw(ribbon, scrollState.value, moved);
      },
      destroy() {
        events.abort();
        layout.disconnect();
        deactivate();
      }
    };
  };
})();
