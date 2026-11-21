(() => {
  "use strict";

  const root = document.documentElement;
  const hero = document.getElementById("fallenHero");
  const photo = document.getElementById("fallenPhoto");
  const intro = document.getElementById("fallenIntro");
  const poster = document.getElementById("fallenPoster");
  const video = document.getElementById("fallenClip");
  const mist = document.getElementById("fallenMist");
  const skip = document.getElementById("fallenSkip");
  const replay = document.getElementById("fallenReplay");
  const header = document.querySelector(".site-header");
  if (!hero || !photo || !intro || !video || !mist || !skip || !replay || !header) {
    root.classList.remove("is-intro-pending");
    return;
  }

  const scriptBase = document.currentScript?.src || new URL("assets/fallen-intro.js", location.href).href;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const portraitMedia = matchMedia("(max-aspect-ratio: 1/1)");
  const sessionKey = "padenie-intro-seen";
  const timers = new Set();

  let phase = "idle";
  let run = 0;
  let cancelLoad;
  let videoFrame = 0;
  let mistTimer = 0;
  let lockedRoots = [];

  function resolveMedia() {
    const portrait = portraitMedia.matches;
    const prefix = portrait ? "fall-v-60" : "fall-60";
    const posterName = portrait ? "fall-v-poster.webp" : "fall-poster.webp";
    return {
      webm: new URL(prefix + ".webm", scriptBase).href,
      mp4: new URL(prefix + ".mp4", scriptBase).href,
      poster: new URL(posterName, scriptBase).href
    };
  }

  function later(callback, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function clearTimers() {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    if (videoFrame && video.cancelVideoFrameCallback) {
      video.cancelVideoFrameCallback(videoFrame);
    }
    videoFrame = 0;
    mistTimer = 0;
  }

  function aimMist() {
    const bounds = photo.getBoundingClientRect();
    const width = photo.naturalWidth || Number(photo.getAttribute("width")) || 1600;
    const height = photo.naturalHeight || Number(photo.getAttribute("height")) || 1200;
    if (!bounds.width || !bounds.height) return;
    const scale = Math.max(bounds.width / width, bounds.height / height);
    const drawnWidth = width * scale;
    const drawnHeight = height * scale;
    const pos = getComputedStyle(photo).objectPosition.split(" ").map(v => parseFloat(v) / 100);
    const posX = Number.isFinite(pos[0]) ? pos[0] : 0.5;
    const posY = Number.isFinite(pos[1]) ? pos[1] : 0.45;
    const eyeX = bounds.left + (bounds.width - drawnWidth) * posX + drawnWidth * 0.50;
    const eyeY = bounds.top + (bounds.height - drawnHeight) * posY + drawnHeight * 0.44;
    mist.style.setProperty("--ex", eyeX.toFixed(1) + "px");
    mist.style.setProperty("--ey", eyeY.toFixed(1) + "px");
  }

  function sizeHero() {
    hero.style.setProperty("--fallen-header-height", header.getBoundingClientRect().height + "px");
    aimMist();
  }

  function unloadClip() {
    video.pause();
    video.replaceChildren();
    video.removeAttribute("src");
    video.removeAttribute("poster");
    video.preload = "none";
    video.load();
  }

  function releaseRoots() {
    for (const [element, wasInert] of lockedRoots) {
      element.inert = wasInert;
    }
    lockedRoots = [];
  }

  function finish() {
    run++;
    cancelLoad?.();
    clearTimers();
    video.pause();
    intro.classList.remove("is-playing");
    intro.hidden = true;
    mist.hidden = true;
    skip.hidden = true;
    mist.className = "fallen-mist";
    hero.classList.remove("is-pre");
    root.classList.remove("is-intro-pending");
    document.body.classList.remove("has-fallen-intro");
    releaseRoots();
    phase = "idle";
    replay.hidden = motion.matches;
    if (document.activeElement === skip && !replay.hidden) {
      replay.focus({ preventScroll: true });
    }
  }

  function coverHero() {
    aimMist();
    hero.classList.add("is-pre");
    document.body.classList.add("has-fallen-intro");
    if (!lockedRoots.length) {
      lockedRoots = Array.from(
        document.querySelectorAll(".skip-link, .site-header, .site-main, .site-footer"),
        element => [element, element.inert]
      );
      for (const [element] of lockedRoots) element.inert = true;
    }
    replay.hidden = true;
    skip.hidden = false;
    intro.hidden = false;
    intro.classList.remove("is-playing");
    mist.hidden = false;
    mist.className = "fallen-mist";
    skip.focus({ preventScroll: true });
  }

  function loadClip(media) {
    return new Promise(resolve => {
      let settled = false;
      const done = ready => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        video.removeEventListener("canplay", onReady);
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("error", onError);
        cancelLoad = undefined;
        if (!ready) unloadClip();
        resolve(ready);
      };
      const onReady = () => done(true);
      const onError = () => done(false);
      const timeout = setTimeout(onError, 3500);
      cancelLoad = () => done(false);

      unloadClip();
      if (poster) poster.src = media.poster;
      video.poster = media.poster;
      const srcWebm = document.createElement("source");
      srcWebm.src = media.webm;
      srcWebm.type = "video/webm";
      const srcMp4 = document.createElement("source");
      srcMp4.src = media.mp4;
      srcMp4.type = "video/mp4";
      video.append(srcWebm, srcMp4);

      video.addEventListener("canplay", onReady, { once: true });
      video.addEventListener("loadeddata", onReady, { once: true });
      video.addEventListener("error", onError, { once: true });
      video.preload = "auto";
      video.load();
    });
  }

  function dissolve(quick = false) {
    if (phase === "idle") return;
    if (phase === "dissolving") {
      if (quick) {
        clearTimers();
        mist.classList.add("is-quick");
        later(() => hero.classList.remove("is-pre"), 160);
        later(finish, 560);
      }
      return;
    }
    phase = "dissolving";
    run++;
    cancelLoad?.();
    clearTimers();
    video.pause();
    intro.hidden = true;
    root.classList.remove("is-intro-pending");
    aimMist();
    mist.hidden = false;
    mist.className = "fallen-mist is-out" + (quick ? " is-quick" : "");
    later(() => hero.classList.remove("is-pre"), quick ? 160 : 520);
    later(finish, quick ? 560 : 1360);
  }

  function liftMist() {
    if (phase === "video") mist.classList.add("is-in");
  }

  function scheduleMist() {
    if (phase !== "video") return;
    clearTimeout(mistTimer);
    timers.delete(mistTimer);
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 2.35;
    const remaining = (duration - 0.42 - video.currentTime) / Math.max(video.playbackRate, 0.1);
    mistTimer = later(liftMist, Math.max(0, remaining * 1000));
  }

  function watchVideoFrame() {
    if (phase !== "video" || !video.requestVideoFrameCallback) return;
    videoFrame = video.requestVideoFrameCallback((_, frame) => {
      videoFrame = 0;
      if (phase !== "video") return;
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 2.35;
      if (frame.mediaTime >= duration - 0.42) liftMist();
      watchVideoFrame();
    });
  }

  async function play(manual = false) {
    if (phase !== "idle" || motion.matches) {
      root.classList.remove("is-intro-pending");
      return;
    }
    phase = "loading";
    const currentRun = ++run;
    const media = resolveMedia();
    coverHero();

    const ready = await loadClip(media);
    if (currentRun !== run || motion.matches) return;
    if (!ready) {
      if (!manual) return finish();
      phase = "mist";
      mist.classList.add("is-full");
      later(() => dissolve(true), 220);
      return;
    }

    phase = "video";
    video.muted = true;
    video.currentTime = 0;
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 2.35;
    later(() => dissolve(), (duration + 1.8) * 1000);
    try {
      await video.play();
      if (currentRun !== run || phase !== "video") return;
      intro.classList.add("is-playing");
      scheduleMist();
      watchVideoFrame();
    } catch {
      if (currentRun === run) finish();
    }
  }

  video.addEventListener("timeupdate", () => {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 2.35;
    if (phase === "video" && video.currentTime >= duration - 0.42) liftMist();
  });
  video.addEventListener("playing", () => {
    intro.classList.add("is-playing");
    scheduleMist();
  });
  video.addEventListener("waiting", () => {
    clearTimeout(mistTimer);
    timers.delete(mistTimer);
  });
  video.addEventListener("ratechange", () => { if (phase === "video") scheduleMist(); });
  video.addEventListener("ended", () => { if (phase === "video") dissolve(); });
  video.addEventListener("error", () => { if (phase === "video") dissolve(); });
  skip.addEventListener("click", () => dissolve(true));
  replay.addEventListener("click", () => play(true));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && phase !== "idle") dissolve(true);
  });
  window.addEventListener("pagehide", finish);
  window.addEventListener("resize", sizeHero);
  photo.addEventListener("load", aimMist);
  new ResizeObserver(sizeHero).observe(header);

  /* Плавный демпфированный 60fps-параллакс полотна (останавливается вне экрана и в покое) */
  let heroVisible = true;
  let targetX = 0;
  let targetY = 0;
  let curX = 0;
  let curY = 0;
  let pRaf = 0;
  let pLast = 0;

  function updateScrollTarget() {
    const sy = Math.min(window.scrollY, window.innerHeight) * 0.08;
    targetY = mouseY * -9 + sy;
  }

  let mouseX = 0;
  let mouseY = 0;

  function stepParallax(now) {
    pRaf = 0;
    if (motion.matches || document.hidden || !heroVisible) {
      pLast = 0;
      return;
    }
    const dt = pLast ? Math.min(0.05, (now - pLast) / 1000) : 0.016;
    pLast = now;
    const ease = 1 - Math.exp(-8.5 * dt);
    curX += (targetX - curX) * ease;
    curY += (targetY - curY) * ease;
    hero.style.setProperty("--px", curX.toFixed(2) + "px");
    hero.style.setProperty("--py", curY.toFixed(2) + "px");

    if (Math.abs(targetX - curX) > 0.06 || Math.abs(targetY - curY) > 0.06) {
      pRaf = requestAnimationFrame(stepParallax);
    } else {
      pLast = 0;
    }
  }

  function askParallax() {
    if (motion.matches || document.hidden || !heroVisible) return;
    if (!pRaf) pRaf = requestAnimationFrame(stepParallax);
  }

  function resetParallax() {
    cancelAnimationFrame(pRaf);
    pRaf = 0;
    pLast = 0;
    curX = curY = targetX = targetY = mouseX = mouseY = 0;
    hero.style.setProperty("--px", "0px");
    hero.style.setProperty("--py", "0px");
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      if (!heroVisible) {
        cancelAnimationFrame(pRaf);
        pRaf = 0;
        pLast = 0;
      } else {
        updateScrollTarget();
        askParallax();
      }
    }).observe(hero);
  }

  window.addEventListener("pointermove", event => {
    if (!finePointer.matches || motion.matches || !heroVisible) return;
    mouseX = event.clientX / window.innerWidth - 0.5;
    mouseY = event.clientY / window.innerHeight - 0.5;
    targetX = mouseX * -14;
    updateScrollTarget();
    askParallax();
  }, { passive: true });

  window.addEventListener("scroll", () => {
    if (!heroVisible || motion.matches) return;
    updateScrollTarget();
    askParallax();
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(pRaf);
      pRaf = 0;
      pLast = 0;
    }
  });

  motion.addEventListener("change", () => {
    finish();
    resetParallax();
    if (motion.matches) unloadClip();
  });

  sizeHero();
  replay.hidden = motion.matches;
  if (motion.matches) {
    root.classList.remove("is-intro-pending");
    return;
  }

  let seen = false;
  try {
    seen = sessionStorage.getItem(sessionKey) === "1";
    if (!seen) sessionStorage.setItem(sessionKey, "1");
  } catch {
    // Работает и без sessionStorage.
  }

  if (!seen) {
    play(false);
  } else {
    root.classList.remove("is-intro-pending");
  }
})();
