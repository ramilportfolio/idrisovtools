(() => {
  "use strict";

  const scene = document.querySelector(".order-scene");
  const transition = document.querySelector(".order-transition");
  const heading = document.getElementById("orderTitle");
  const steps = Array.from(scene.querySelectorAll(".steps-list > li"));
  const contact = document.getElementById("contacts");
  const header = document.querySelector(".site-header");
  const motion = matchMedia("(prefers-reduced-motion: no-preference)");
  if (typeof CONFIG !== "undefined") contact.querySelector(".contact-signature").textContent = CONFIG.name;

  let current = 0;
  let orderVisible = false;
  let transitionVisible = false;
  let frame = 0;
  let washCurrent = null;
  let previousFrame = 0;

  function paint(now = performance.now()) {
    frame = 0;
    const headerHeight = header.offsetHeight;
    if (orderVisible) {
      const readingLine = headerHeight + (innerHeight - headerHeight) * .40;
      let closest = 0;
      let distance = Infinity;
      for (let index = 0; index < steps.length; index++) {
        const row = steps[index].getBoundingClientRect();
        const delta = Math.abs(row.top + row.height / 2 - readingLine);
        if (delta < distance) {
          closest = index;
          distance = delta;
        }
      }
      if (closest !== current) {
        steps[current].classList.remove("is-current");
        steps[closest].classList.add("is-current");
        current = closest;
      }
    }

    let settling = false;
    if (transitionVisible && motion.matches) {
      const box = transition.getBoundingClientRect();
      const progress = (innerHeight - box.top) / (innerHeight - headerHeight + box.height);
      const fade = Math.max(0, Math.min(1, (progress - .34) / .65));
      const target = fade * fade * .85;
      if (washCurrent === null || !previousFrame) {
        washCurrent = target;
      } else {
        const dt = Math.min(.05, Math.max(0, (now - previousFrame) / 1000));
        washCurrent += (target - washCurrent) * (1 - Math.exp(-16 * dt));
      }
      previousFrame = now;
      transition.style.setProperty("--order-wash", washCurrent.toFixed(4));
      settling = Math.abs(target - washCurrent) > .0004;
    } else {
      previousFrame = 0;
    }
    if (settling) schedule();
  }

  function schedule() {
    if (!document.hidden && (orderVisible || transitionVisible) && !frame) {
      frame = requestAnimationFrame(paint);
    }
  }

  function updateMotion() {
    scene.classList.toggle("is-in-view", orderVisible && motion.matches && !document.hidden);
    if (!motion.matches) {
      washCurrent = null;
      previousFrame = 0;
      scene.classList.remove("is-revealing");
      contact.classList.remove("is-revealing");
      transition.style.removeProperty("--order-wash");
    }
    schedule();
  }

  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const shown = entry.isIntersecting && entry.intersectionRatio >= .025;
      if (entry.target === scene) orderVisible = shown;
      else transitionVisible = shown;
    }
    updateMotion();
  }, { threshold: .025 });
  visibility.observe(scene);
  visibility.observe(transition);

  const reveals = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < .24) continue;
      if (motion.matches) {
        const section = entry.target === heading ? scene : contact;
        section.classList.add("is-revealing");
        setTimeout(() => section.classList.remove("is-revealing"), 1120);
      }
      reveals.unobserve(entry.target);
    }
  }, { threshold: .24, rootMargin: "-64px 0px 0px" });
  reveals.observe(heading);
  reveals.observe(contact.querySelector(".final-contact__title"));

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", updateMotion);
  motion.addEventListener("change", updateMotion);
})();
