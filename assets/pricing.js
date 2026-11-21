(() => {
  "use strict";

  const band = document.querySelector(".pricing-band");
  if (!band) return;

  const motionReduce = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

  /* «от» аккуратным курсивом в карточках цен */
  band.querySelectorAll(".price-card b").forEach(b => {
    const t = b.textContent.trim();
    if (/^от\s/.test(t) && !b.querySelector("small")) {
      const small = document.createElement("small");
      small.textContent = "от";
      b.textContent = " " + t.slice(3);
      b.prepend(small);
    }
  });

  /* Плавный счётчик суммы сметы без MutationObserver-хака */
  const sumEl = document.getElementById("estSum");
  const fmt = n => Math.round(n).toLocaleString("ru-RU") + " ₽";
  let shown = sumEl ? (parseInt(sumEl.textContent.replace(/\D/g, ""), 10) || 0) : 0;
  let lastTarget = shown;
  let raf = 0;

  window.animateEstimateSum = function animateEstimateSum(target) {
    if (!sumEl) return;
    lastTarget = target;
    cancelAnimationFrame(raf);
    raf = 0;
    if (motionReduce.matches || target === shown) {
      shown = target;
      sumEl.textContent = fmt(target);
      return;
    }
    const from = shown;
    const t0 = performance.now();
    const duration = 460;
    const step = now => {
      const progress = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      shown = Math.round(from + (target - from) * eased);
      sumEl.textContent = fmt(shown);
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        shown = target;
        sumEl.textContent = fmt(target);
        raf = 0;
      }
    };
    raf = requestAnimationFrame(step);
  };

  /* Мягкий отблеск света по курсору на тёмной панели итога */
  const panel = band.querySelector(".est-total-panel");
  if (panel) {
    panel.addEventListener("pointermove", event => {
      if (motionReduce.matches || !finePointer.matches || event.pointerType !== "mouse") return;
      const rect = panel.getBoundingClientRect();
      panel.style.setProperty("--mx", (event.clientX - rect.left).toFixed(1) + "px");
      panel.style.setProperty("--my", (event.clientY - rect.top).toFixed(1) + "px");
    }, { passive: true });
  }

  motionReduce.addEventListener("change", () => {
    if (motionReduce.matches && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      if (sumEl) {
        shown = lastTarget;
        sumEl.textContent = fmt(lastTarget);
      }
    }
  });
})();
