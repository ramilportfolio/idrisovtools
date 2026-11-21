(() => {
  "use strict";

  const portfolio = document.getElementById("portfolio");
  const grid = document.getElementById("projectsGrid");
  if (!portfolio || !grid || typeof PROJECTS === "undefined") return;

  const track = portfolio.querySelector(".portfolio-track");
  const stage = portfolio.querySelector(".portfolio-stage");
  const mosaic = portfolio.querySelector(".portfolio-mosaic");
  const pager = portfolio.querySelector(".portfolio-pager");
  const filters = Array.from(document.querySelectorAll("#filterBar button"));
  const [previousButton, nextButton] = pager.querySelectorAll("button");
  const status = pager.querySelector("output");
  const header = document.querySelector(".site-header");
  const following = document.getElementById("services");
  const desktop = matchMedia("(min-width: 1024px) and (min-height: 690px) and (pointer: fine)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const projects = new Map(PROJECTS.map(project => [project.href, project]));
  const canScroll = () =>
    desktop.matches &&
    !reducedMotion.matches &&
    !navigator.connection?.saveData &&
    !(navigator.deviceMemory < 4) &&
    CSS.supports("position", "sticky") &&
    "inert" in HTMLElement.prototype;

  let cards = [];
  let enabled = false;
  let nearby = false;
  let current = -1;
  let frame = 0;
  let step = 0;
  let travel = 0;
  let parallaxCurrent = null;
  let previousParallaxFrame = 0;

  function formatRoman(num) {
    const map = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    return map[num - 1] || String(num);
  }

  function prepare(card, idx) {
    const body = card.querySelector(".b");
    if (!body || body.querySelector(".portfolio-index-badge")) return;
    const thumbLink = card.querySelector(".thumb");
    const project = projects.get(thumbLink?.getAttribute("href"));
    if (!project) return;

    const badge = document.createElement("div");
    badge.className = "portfolio-index-badge";
    const numSpan = document.createElement("span");
    numSpan.textContent = "Экспонат " + formatRoman(idx + 1);
    const label = document.createElement("span");
    label.className = "portfolio-project-tag";
    label.textContent = project.tag;
    badge.append(numSpan, label);
    body.prepend(badge);
  }

  function prepareMosaic() {
    if (!mosaic || mosaic.childElementCount) return;
    const pictures = document.createDocumentFragment();
    for (const project of projects.values()) {
      const image = document.createElement("img");
      image.alt = "";
      image.decoding = "async";
      image.fetchPriority = "low";
      image.width = 700;
      image.height = 420;
      image.src = project.localThumb;
      pictures.append(image);
    }
    mosaic.append(pictures);
  }

  const deviceSizes = {
    monitor: [1000, 625],
    tablet: [480, 640],
    phone: [340, 680]
  };

  function bindDeviceTilt(thumbnail, devices) {
    if (thumbnail.dataset.tiltBound === "1") return;
    thumbnail.dataset.tiltBound = "1";

    thumbnail.addEventListener("pointermove", event => {
      if (!finePointer.matches || reducedMotion.matches || event.pointerType !== "mouse") return;
      const box = thumbnail.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const nx = ((event.clientX - box.left) / box.width - 0.5) * 2;
      const ny = ((event.clientY - box.top) / box.height - 0.5) * 2;
      devices.style.setProperty("--tilt-x", Math.max(-1, Math.min(1, nx)).toFixed(3));
      devices.style.setProperty("--tilt-y", Math.max(-1, Math.min(1, ny)).toFixed(3));
    }, { passive: true });

    thumbnail.addEventListener("pointerleave", () => {
      devices.style.setProperty("--tilt-x", "0");
      devices.style.setProperty("--tilt-y", "0");
    });
  }

  function prepareDevices(card, priority, lazy = false) {
    if (!card) return;
    const thumbnail = card.querySelector(".thumb");
    if (!thumbnail) return;
    const existing = thumbnail.querySelector(".portfolio-devices");
    if (existing) {
      if (!lazy) {
        for (const image of existing.querySelectorAll('img[loading="lazy"]')) {
          image.loading = "eager";
        }
      }
      return;
    }
    const project = projects.get(thumbnail.getAttribute("href"));
    if (!project) return;
    const projectName = project.href.replace(/\.html$/, "");
    const devices = document.createElement("span");
    devices.className = "portfolio-devices";
    devices.setAttribute("aria-hidden", "true");
    for (const [type, [width, height]] of Object.entries(deviceSizes)) {
      const device = document.createElement("span");
      device.className = "portfolio-device portfolio-device--" + type;
      const preview = document.createElement("img");
      preview.alt = "";
      preview.decoding = "async";
      if (lazy) preview.loading = "lazy";
      preview.fetchPriority = priority;
      preview.width = width;
      preview.height = height;
      preview.addEventListener("error", () => {
        preview.width = 700;
        preview.height = 420;
        preview.src = project.localThumb;
      }, { once: true });
      preview.src = "assets/projects/" + projectName + "-" + type + ".webp";
      device.append(preview);
      devices.append(device);
    }
    thumbnail.append(devices);
    bindDeviceTilt(thumbnail, devices);
  }

  function loadNearby(index) {
    if (!nearby || index < 0) return;
    prepareMosaic();
    prepareDevices(cards[index], "auto");
    prepareDevices(cards[index + 1], "low");
    prepareDevices(cards[index - 1], "low");
  }

  function offsetInTrack() {
    return Math.max(0, header.offsetHeight - track.getBoundingClientRect().top);
  }

  function sizeStage() {
    const top = header.offsetHeight;
    const height = document.documentElement.clientHeight - top;
    step = Math.round(Math.max(300, Math.min(450, height * 0.45)));
    travel = Math.max(0, (cards.length - 1) * step);
    stage.style.setProperty("--portfolio-top", top + "px");
    stage.style.setProperty("--portfolio-height", height + "px");
    track.style.minHeight = height + travel + "px";
  }

  function updateStageTone(card) {
    const href = card?.querySelector(".thumb")?.getAttribute("href");
    const project = href ? projects.get(href) : null;
    if (project?.cat) stage.dataset.tone = project.cat;
  }

  function chooseSlide(index, animate) {
    if (index === current || !cards[index]) return;
    const previous = cards[current];
    const active = cards[index];
    const direction = index < current ? -1 : 1;
    if (previous?.contains(document.activeElement)) {
      portfolio.querySelector("#filterBar .active")?.focus({ preventScroll: true });
    }

    loadNearby(index);
    updateStageTone(active);
    stage.style.setProperty("--portfolio-direction", String(direction));
    for (const card of cards) {
      const selected = card === active;
      card.classList.toggle("is-current", selected);
      card.classList.toggle("is-entering", selected && animate);
      card.classList.toggle("is-leaving", card === previous && animate);
      card.inert = !selected;
      if (selected) card.removeAttribute("aria-hidden");
      else card.setAttribute("aria-hidden", "true");
    }
    current = index;
    status.textContent = (index + 1) + " / " + cards.length;
    status.setAttribute("aria-label", "Проект " + (index + 1) + " из " + cards.length);
    previousButton.setAttribute("aria-disabled", String(index === 0));
    nextButton.setAttribute("aria-disabled", String(index === cards.length - 1));
  }

  function paint(animate = true, now = performance.now()) {
    frame = 0;
    if (!enabled || !cards.length) return;
    const offset = offsetInTrack();
    const index = Math.min(cards.length - 1, Math.floor(offset / step + 0.28));
    const targetParallax = travel ? (Math.min(1, offset / travel) - 0.5) * 120 : 0;
    if (!animate || parallaxCurrent === null || !previousParallaxFrame) {
      parallaxCurrent = targetParallax;
    } else {
      const dt = Math.min(0.05, Math.max(0, (now - previousParallaxFrame) / 1000));
      parallaxCurrent += (targetParallax - parallaxCurrent) * (1 - Math.exp(-14 * dt));
    }
    previousParallaxFrame = now;
    stage.style.setProperty("--portfolio-parallax", parallaxCurrent.toFixed(2) + "px");
    chooseSlide(index, animate);
    if (animate && Math.abs(targetParallax - parallaxCurrent) > 0.08) schedule();
  }

  function schedule() {
    if (enabled && nearby && !frame && !document.hidden) {
      frame = requestAnimationFrame(now => paint(true, now));
    }
  }

  function enable() {
    enabled = true;
    current = -1;
    parallaxCurrent = null;
    previousParallaxFrame = 0;
    cards.forEach((card, idx) => prepare(card, idx));
    stage.classList.add("is-scroll");
    pager.hidden = cards.length < 2;
    sizeStage();
    paint(false);
  }

  function disable() {
    const active = cards[current];
    const trackBox = track.getBoundingClientRect();
    const headerHeight = header.offsetHeight;
    const followingTop = following ? following.getBoundingClientRect().top : Infinity;
    const wasBelowTrack = followingTop <= headerHeight + 35;
    const wasInTrack = !wasBelowTrack && trackBox.top < headerHeight && trackBox.bottom > headerHeight;
    if (pager.contains(document.activeElement)) {
      portfolio.querySelector("#filterBar .active")?.focus({ preventScroll: true });
    }

    enabled = false;
    current = -1;
    cancelAnimationFrame(frame);
    frame = 0;
    pager.hidden = true;
    stage.classList.remove("is-scroll");
    track.style.removeProperty("min-height");
    for (const card of cards) {
      card.classList.remove("is-current", "is-entering", "is-leaving");
      card.removeAttribute("aria-hidden");
      card.inert = false;
      prepareDevices(card, "low", true);
    }

    if (wasInTrack && active) {
      window.scrollBy({ top: active.getBoundingClientRect().top - headerHeight - 12, behavior: "instant" });
    } else if (wasBelowTrack && following) {
      window.scrollBy({ top: following.getBoundingClientRect().top - followingTop, behavior: "instant" });
    }
  }

  function syncMode() {
    if (canScroll()) {
      if (!enabled) enable();
      else {
        sizeStage();
        schedule();
      }
    } else if (enabled) {
      disable();
    }
  }

  function syncCards() {
    const activeBtn = filters.find(f => f.classList.contains("active"));
    for (const filter of filters) {
      filter.setAttribute("aria-pressed", String(filter === activeBtn));
    }
    if (activeBtn && activeBtn.dataset.cat !== "all") {
      stage.dataset.tone = activeBtn.dataset.cat;
    }

    const bounds = track.getBoundingClientRect();
    const hadOffset = enabled && bounds.top < header.offsetHeight - 2 && bounds.bottom > header.offsetHeight;
    const start = window.scrollY + bounds.top - header.offsetHeight;
    cards = Array.from(grid.children);
    if (!enabled) {
      if (!canScroll()) {
        for (const card of cards) prepareDevices(card, "low", true);
      }
      return;
    }
    current = -1;
    cards.forEach((card, idx) => prepare(card, idx));
    pager.hidden = cards.length < 2;
    sizeStage();
    if (hadOffset) window.scrollTo({ top: Math.max(0, start), behavior: "instant" });
    paint(false);
  }

  function navigate(direction) {
    if (!enabled) return;
    const index = current + direction;
    if (!cards[index]) return;
    const start = window.scrollY + track.getBoundingClientRect().top - header.offsetHeight;
    window.scrollTo({ top: start + index * step, behavior: reducedMotion.matches ? "instant" : "smooth" });
    paint();
  }

  /* Клик по превью открывает модалку предпросмотра (Ctrl/Cmd/Shift сохраняет открытие в новой вкладке) */
  grid.addEventListener("click", event => {
    const thumb = event.target.closest("a.thumb");
    if (!thumb || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const project = projects.get(thumb.getAttribute("href"));
    if (project && typeof window.openModal === "function") {
      event.preventDefault();
      window.openModal(project.href, project.title, thumb);
    }
  });

  previousButton.addEventListener("click", () => navigate(-1));
  nextButton.addEventListener("click", () => navigate(1));

  grid.addEventListener("animationend", event => {
    const card = event.target.closest(".card");
    if (!card) return;
    if (event.animationName === "portfolio-device-out") {
      card.classList.remove("is-leaving");
    } else if (event.animationName === "portfolio-device-in") {
      card.classList.remove("is-entering");
    }
  });

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", syncMode);
  desktop.addEventListener("change", syncMode);
  reducedMotion.addEventListener("change", () => {
    for (const dev of grid.querySelectorAll(".portfolio-devices")) {
      dev.style.setProperty("--tilt-x", "0");
      dev.style.setProperty("--tilt-y", "0");
    }
    syncMode();
  });

  const observer = new IntersectionObserver(([entry]) => {
    nearby = entry.isIntersecting;
    if (enabled && nearby) {
      paint(false);
      loadNearby(current);
    }
  }, { rootMargin: "220px 0px" });
  observer.observe(stage);

  const changes = new MutationObserver(syncCards);
  changes.observe(grid, { childList: true });
  syncCards();
  syncMode();
})();
