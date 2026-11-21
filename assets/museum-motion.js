(() => {
  "use strict";

  const motionReduce = matchMedia("(prefers-reduced-motion: reduce)");
  const desktopMotion = matchMedia("(min-width: 821px) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  const header = document.querySelector(".site-header");

  /* 1. Подсветка активного пункта навигации (scrollspy) */
  if (header) {
    const navWrap = header.querySelector(".nav-links");
    const navLinks = Array.from(header.querySelectorAll(".nav-links a"));
    const sections = navLinks
      .map(link => [document.getElementById(link.hash.slice(1)), link])
      .filter(([section]) => Boolean(section));
    let activeLink;
    let navRaf = 0;

    function updateNav() {
      navRaf = 0;
      const readingLine = header.offsetHeight + Math.min(200, Math.round(window.innerHeight * 0.28));
      let nextLink;
      const atBottom =
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      if (atBottom && sections.length) {
        nextLink = sections[sections.length - 1][1];
      } else {
        for (const [section, link] of sections) {
          if (section.getBoundingClientRect().top <= readingLine) nextLink = link;
        }
      }
      if (nextLink === activeLink) return;
      activeLink?.removeAttribute("aria-current");
      nextLink?.setAttribute("aria-current", "location");
      activeLink = nextLink;
      if (nextLink && navWrap && navWrap.scrollWidth > navWrap.clientWidth + 2) {
        const targetLeft = Math.max(0, nextLink.offsetLeft - (navWrap.clientWidth - nextLink.offsetWidth) / 2);
        navWrap.scrollTo({ left: targetLeft, behavior: motionReduce.matches ? "auto" : "smooth" });
      }
    }

    const scheduleNav = () => {
      if (!navRaf) navRaf = requestAnimationFrame(updateNav);
    };

    window.addEventListener("scroll", scheduleNav, { passive: true });
    window.addEventListener("resize", scheduleNav);
    window.addEventListener("hashchange", scheduleNav);
    updateNav();
  }

  /* 2. Лёгкий магнитный отклик главных кнопок на десктопе */
  const magneticButtons = Array.from(document.querySelectorAll(".hero .btn, .site-header .btn"));
  for (const button of magneticButtons) {
    const reset = () => {
      button.style.removeProperty("--magnetic-x");
      button.style.removeProperty("--magnetic-y");
    };
    button.addEventListener("pointermove", event => {
      if (!desktopMotion.matches || event.pointerType !== "mouse") return;
      const box = button.getBoundingClientRect();
      const shift = delta => Math.max(-5, Math.min(5, delta * 0.10)) + "px";
      button.style.setProperty("--magnetic-x", shift(event.clientX - box.left - box.width / 2));
      button.style.setProperty("--magnetic-y", shift(event.clientY - box.top - box.height / 2));
    });
    button.addEventListener("pointerleave", reset);
    desktopMotion.addEventListener("change", reset);
  }

  /* 3. Плавные GPU-появления карточек и секций (без filter: blur) */
  const revealTargets = Array.from(document.querySelectorAll(
    ".pricing-band .sec-head, .pricing-band .price-card, .pricing-band .estimator-card, .about-content .box-card, #faq .faq-item"
  ));

  let revealObserver = null;
  function initReveals() {
    if (revealObserver) {
      revealObserver.disconnect();
      revealObserver = null;
    }
    if (motionReduce.matches || !("IntersectionObserver" in window)) {
      document.documentElement.classList.remove("js-reveal");
      for (const el of revealTargets) el.classList.add("is-in");
      return;
    }
    document.documentElement.classList.add("js-reveal");
    for (const el of revealTargets) {
      el.classList.add("reveal-item");
    }
    revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        const idx = Array.from(el.parentElement?.children || []).indexOf(el);
        el.style.setProperty("--reveal-d", Math.min(Math.max(idx, 0), 5) * 65 + "ms");
        el.classList.add("is-in");
        revealObserver.unobserve(el);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });

    for (const el of revealTargets) {
      if (!el.classList.contains("is-in")) revealObserver.observe(el);
    }
  }
  initReveals();

  /* 4. Подсветка активного шага «Как заказать» (01–04) при скролле */
  const orderScene = document.querySelector(".order-scene");
  const steps = orderScene ? Array.from(orderScene.querySelectorAll(".steps-list > li")) : [];
  let orderVisible = false;
  let currentStep = 0;
  let stepRaf = 0;

  function paintSteps() {
    stepRaf = 0;
    if (!orderVisible || !steps.length) return;
    const topOffset = header ? header.offsetHeight : 74;
    const readingLine = topOffset + (window.innerHeight - topOffset) * 0.42;
    let closest = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < steps.length; i++) {
      const box = steps[i].getBoundingClientRect();
      const delta = Math.abs(box.top + box.height / 2 - readingLine);
      if (delta < bestDelta) {
        bestDelta = delta;
        closest = i;
      }
    }
    if (closest !== currentStep) {
      steps[currentStep]?.classList.remove("is-current");
      steps[closest]?.classList.add("is-current");
      currentStep = closest;
    }
  }

  function scheduleSteps() {
    if (orderVisible && !stepRaf && !document.hidden) {
      stepRaf = requestAnimationFrame(paintSteps);
    }
  }

  if (orderScene && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      orderVisible = entry.isIntersecting;
      if (orderVisible) scheduleSteps();
    }, { threshold: 0.05 }).observe(orderScene);
    window.addEventListener("scroll", scheduleSteps, { passive: true });
    window.addEventListener("resize", scheduleSteps);
  }

  /* 5. Атмосферное дыхание света в финальном зале #contacts (только в поле зрения) */
  const contacts = document.getElementById("contacts");
  let contactsVisible = false;

  function syncContactsAura() {
    if (!contacts) return;
    contacts.classList.toggle("is-in-view", contactsVisible && !motionReduce.matches && !document.hidden);
  }

  if (contacts && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      contactsVisible = entry.isIntersecting;
      syncContactsAura();
    }, { threshold: 0.05 }).observe(contacts);
  }

  document.addEventListener("visibilitychange", syncContactsAura);
  motionReduce.addEventListener("change", () => {
    initReveals();
    syncContactsAura();
  });

  if (typeof CONFIG !== "undefined") {
    const sig = document.querySelector(".contact-signature");
    if (sig) sig.textContent = CONFIG.name;
  }
})();
