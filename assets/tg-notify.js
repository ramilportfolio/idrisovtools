(() => {
  "use strict";

  const root = document.getElementById("tgMock");
  if (!root || !("IntersectionObserver" in window)) return;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const bubbles = [root.querySelector(".tg-bubble--1"), root.querySelector(".tg-bubble--2")];
  const pushes = [root.querySelector(".tg-push--1"), root.querySelector(".tg-push--2")];
  const replay = root.querySelector(".tg-replay");
  if (!replay || bubbles.some(element => !element) || pushes.some(element => !element)) return;

  const totals = bubbles.map(bubble => bubble.querySelector(".tg-total"));
  const sums = bubbles.map(bubble => bubble.querySelector(".tg-sum"));
  const finals = sums.map(element => Number(element.dataset.sum));
  const money = new Intl.NumberFormat("ru-RU");
  const timers = new Set();
  let frame = 0;
  let played = false;
  let playing = false;
  let visible = false;
  let ready = false;

  const setSum = (index, value) => {
    sums[index].textContent = money.format(value) + "\u00a0₽";
  };

  function later(delay, callback) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  }

  function countUp(index) {
    const start = performance.now();
    let previous = -1;
    function tick(now) {
      const progress = Math.max(0, Math.min(1, (now - start) / 760));
      const value = Math.round(finals[index] * (1 - (1 - progress) ** 3));
      if (value !== previous) {
        setSum(index, value);
        previous = value;
      }
      frame = progress < 1 ? requestAnimationFrame(tick) : 0;
    }
    frame = requestAnimationFrame(tick);
  }

  function reset() {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    cancelAnimationFrame(frame);
    frame = 0;
    playing = false;
    root.classList.remove("is-glow", "is-ping", "is-pushing", "is-typing");
    for (const push of pushes) push.classList.remove("is-on");
    for (const bubble of bubbles) bubble.classList.remove("is-in", "is-behind", "is-sent", "is-read");
    for (const total of totals) total.classList.remove("is-hot");
  }

  function finish() {
    reset();
    for (let index = 0; index < bubbles.length; index++) {
      setSum(index, finals[index]);
      bubbles[index].classList.add("is-in", "is-sent", "is-read");
    }
    bubbles[0].classList.add("is-behind");
  }

  function playLead(index, start) {
    later(start, () => {
      pushes[index].classList.add("is-on");
      root.classList.add("is-ping", "is-pushing");
    });
    later(start + 1320, () => {
      pushes[index].classList.remove("is-on");
      bubbles[index].classList.add("is-in");
      if (index === 0) root.classList.remove("is-typing");
      else bubbles[index - 1].classList.add("is-behind");
      root.classList.add("is-glow");
    });
    later(start + 1740, () => root.classList.remove("is-pushing"));
    later(start + 1840, () => countUp(index));
    later(start + 2640, () => totals[index].classList.add("is-hot"));
    later(start + 2770, () => bubbles[index].classList.add("is-sent"));
    later(start + 3250, () => bubbles[index].classList.add("is-read"));
    later(start + 3370, () => totals[index].classList.remove("is-hot"));
  }

  function play() {
    if (reduce.matches || document.hidden || !visible) return;
    reset();
    played = playing = true;
    root.classList.add("is-typing");
    for (let index = 0; index < sums.length; index++) setSum(index, 0);
    playLead(0, 320);
    playLead(1, 4380);
    later(7900, () => { playing = false; });
  }

  function syncMotion() {
    reset();
    played = false;
    const enabled = !reduce.matches;
    root.classList.toggle("is-armed", enabled);
    replay.hidden = !enabled;
    for (let index = 0; index < sums.length; index++) setSum(index, enabled ? 0 : finals[index]);
    if (enabled && ready) play();
  }

  root.addEventListener("animationend", event => {
    if (event.animationName === "tg-delivery-glow") root.classList.remove("is-glow");
    if (event.animationName === "tg-ping") root.classList.remove("is-ping");
  });
  replay.addEventListener("click", play);
  reduce.addEventListener("change", syncMotion);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && playing) finish();
    if (!document.hidden && ready && !played) play();
  });

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    ready = visible && entry.intersectionRatio >= .38;
    if (!visible && playing) finish();
    if (ready && !played) play();
  }, { threshold: [0, .38] });
  observer.observe(root);
  syncMotion();
})();
