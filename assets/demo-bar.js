(() => {
  "use strict";

  /* Единое неблокирующее inline-уведомление об ошибке валидации (работает и в sandbox-iframe) */
  let errTimer = null;
  window.demoShowError = function demoShowError(message, anchorEl) {
    let box = document.getElementById("demoInlineErr");
    if (!box) {
      box = document.createElement("div");
      box.id = "demoInlineErr";
      box.className = "demo-inline-err";
      box.setAttribute("role", "alert");
    }
    const target = anchorEl || document.querySelector("button.main, #send, #btn");
    if (target && target.parentNode) {
      if (box.parentNode !== target.parentNode || box.nextSibling !== target) {
        target.parentNode.insertBefore(box, target);
      }
    } else if (!box.parentNode) {
      document.body.prepend(box);
    }
    box.textContent = message;
    box.hidden = false;
    clearTimeout(errTimer);
    errTimer = setTimeout(() => { box.hidden = true; }, 4500);
  };

  document.addEventListener("input", () => {
    const box = document.getElementById("demoInlineErr");
    if (box) box.hidden = true;
  }, { passive: true });

  if (window.self !== window.top) {
    /* Проброс Escape в родительскую модалку предпросмотра, если внутри демо не открыта своя модалка */
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      const tgModal = document.getElementById("tgPreviewModal");
      const tgOpen = tgModal && getComputedStyle(tgModal).display !== "none";
      const winModal = document.getElementById("winModal");
      const winOpen = winModal && winModal.classList.contains("show");
      const nativeDialogOpen = Boolean(document.querySelector("dialog[open]"));
      if (tgOpen || winOpen || nativeDialogOpen) return;
      try {
        window.parent.postMessage({ type: "preview-modal-escape" }, "*");
      } catch {}
    }, true);
    return;
  }

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
  order.rel = "noopener noreferrer";
  order.textContent = "Заказать такой же →";

  bar.append(home, order);
  document.body.prepend(bar);
})();
