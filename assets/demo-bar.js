(() => {
  if (window.self !== window.top) return;

  const bar = document.createElement("nav");
  bar.className = "demo-site-bar";
  bar.setAttribute("aria-label", "Навигация демо-проекта");

  const home = document.createElement("a");
  home.href = "https://ramil-tools.ru/";
  home.textContent = "← На главную";

  const order = document.createElement("a");
  const telegram = new URL("https://t.me/ramiltools");
  telegram.searchParams.set("text", "Здравствуйте! Хочу такой же проект: " + document.title);
  order.href = telegram.href;
  order.dataset.goal = "tg_click";
  order.target = "_blank";
  order.rel = "noopener";
  order.textContent = "Заказать такой же →";

  bar.append(home, order);
  document.body.prepend(bar);
})();
