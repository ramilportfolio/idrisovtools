(() => {
  const YM_ID = 0; // TODO: подставить номер счётчика Яндекс Метрики.
  if (window.self !== window.top || !Number.isSafeInteger(YM_ID) || YM_ID <= 0) return;

  function track(goal) {
    try {
      if (typeof window.ym === "function") window.ym(YM_ID, "reachGoal", goal);
    } catch {
      // Аналитика не должна влиять на действия посетителя.
    }
  }

  if (typeof window.ym !== "function") {
    const ym = function (...args) { ym.a.push(args); };
    ym.a = [];
    ym.l = Date.now();
    window.ym = ym;

    const script = document.createElement("script");
    script.src = "https://mc.yandex.ru/metrika/tag.js";
    script.async = true;
    document.head.append(script);
  }

  window.ym(YM_ID, "init", { webvisor: false });
  document.addEventListener("click", event => {
    const goal = event.target.closest?.("[data-goal]")?.dataset.goal;
    if (goal) track(goal);
  }, { capture: true });
})();
