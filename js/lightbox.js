/* ========== Лайтбокс контентных изображений ==========
 * Чистый JS, без зависимостей. Открывает контентные фото кейса
 * поверх затемнённого оверлея, листает их стрелками/свайпом,
 * закрывается по крестику / фону / Escape. Иконки и логотипы
 * не затрагиваются — собираем только фото из контентных контейнеров.
 *
 * Зум (десктоп): колесо мыши к точке курсора, двойной клик,
 * перетаскивание (pan) приближённого фото, кнопки +/−/сброс.
 * Зум (мобайл): pinch двумя пальцами + перетаскивание одним.
 */
(function () {
  // Контейнеры с контентными фото (обе дизайн-системы кейсов)
  const CONTENT_SELECTOR = [
    ".case2-hero img",
    ".case2-phone img",
    ".case2-audit img",
    ".case2-media img",
    ".case-hero img",
    ".case-design img",
    ".case-photos img",
  ].join(",");

  const triggers = Array.prototype.slice.call(
    document.querySelectorAll(CONTENT_SELECTOR)
  );
  if (!triggers.length) return;

  // Границы и шаги масштабирования
  const MIN_SCALE = 1;
  const MAX_SCALE = 4.5;
  const CLICK_SCALE = 2.5; // масштаб приближения по одиночному клику
  const WHEEL_STEP = 1.15;
  const BTN_STEP = 1.4;

  // ---- Разметка лайтбокса (создаётся один раз) ----
  const SVG_NS = "http://www.w3.org/2000/svg";

  function icon(paths) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    paths.forEach((d) => {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", d);
      p.setAttribute("stroke", "currentColor");
      p.setAttribute("stroke-width", "2");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      svg.appendChild(p);
    });
    return svg;
  }

  function button(cls, label, paths) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lightbox__btn " + cls;
    b.setAttribute("aria-label", label);
    b.appendChild(icon(paths));
    return b;
  }

  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Просмотр изображения");
  overlay.setAttribute("aria-hidden", "true");

  const closeBtn = button("lightbox__close", "Закрыть", ["M6 6l12 12", "M18 6L6 18"]);

  const stage = document.createElement("div");
  stage.className = "lightbox__stage";

  const img = document.createElement("img");
  img.className = "lightbox__img";
  img.alt = "";
  img.setAttribute("draggable", "false");
  stage.appendChild(img);

  // Панель зума: отдалить / сбросить / приблизить — по центру внизу
  const zoomOutBtn = button("", "Отдалить", ["M5 12h14"]);
  const resetBtn = button("", "Сбросить масштаб", [
    "M4 9V5a1 1 0 0 1 1-1h4",
    "M20 9V5a1 1 0 0 0-1-1h-4",
    "M4 15v4a1 1 0 0 0 1 1h4",
    "M20 15v4a1 1 0 0 1-1 1h-4",
  ]);
  const zoomInBtn = button("", "Приблизить", ["M12 5v14", "M5 12h14"]);
  const zoomControls = document.createElement("div");
  zoomControls.className = "lightbox__zoom";
  zoomControls.appendChild(zoomOutBtn);
  zoomControls.appendChild(resetBtn);
  zoomControls.appendChild(zoomInBtn);

  overlay.appendChild(closeBtn);
  overlay.appendChild(stage);
  overlay.appendChild(zoomControls);
  document.body.appendChild(overlay);

  // ---- Состояние ----
  let lastFocused = null;

  // Состояние трансформации
  let scale = 1;
  let tx = 0;
  let ty = 0;

  function isOpen() {
    return overlay.classList.contains("is-open");
  }

  function fullSrc(el) {
    return el.currentSrc || el.src;
  }

  // ---- Зум и панорама ----
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function applyTransform() {
    img.style.transform =
      "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
  }

  function updateCursor() {
    img.classList.toggle("is-zoomed", scale > 1.001);
  }

  // Геометрический центр изображения на экране (без учёта зум-трансформации:
  // layout-бокс сцены не меняется при visual-transform потомка).
  function imageCenter() {
    const r = stage.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Не даём вытащить картинку за пределы видимой области
  function clampPan() {
    const cw = overlay.clientWidth;
    const ch = overlay.clientHeight;
    const maxX = Math.max(0, (img.clientWidth * scale - cw) / 2);
    const maxY = Math.max(0, (img.clientHeight * scale - ch) / 2);
    tx = clamp(tx, -maxX, maxX);
    ty = clamp(ty, -maxY, maxY);
  }

  // Зум к точке (cx, cy) — экранные координаты фокуса
  function zoomTo(nextScale, cx, cy) {
    nextScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const c = imageCenter();
    const vx = cx - c.x;
    const vy = cy - c.y;
    const ratio = nextScale / scale;
    // Точка под фокусом остаётся на месте: t1 = v - ratio*(v - t0)
    tx = vx - ratio * (vx - tx);
    ty = vy - ratio * (vy - ty);
    scale = nextScale;
    clampPan();
    applyTransform();
    updateCursor();
  }

  // Зум кнопками/клавишами — фокус в центре экрана
  function zoomByCenter(factor) {
    zoomTo(scale * factor, window.innerWidth / 2, window.innerHeight / 2);
  }

  function resetZoom(instant) {
    scale = 1;
    tx = 0;
    ty = 0;
    if (instant) {
      img.classList.add("is-panning"); // отключаем transition на сброс
      applyTransform();
      void img.offsetWidth; // форсируем reflow
      img.classList.remove("is-panning");
    } else {
      applyTransform();
    }
    updateCursor();
  }

  function show(el) {
    img.src = fullSrc(el);
    img.alt = el.alt || "";
    resetZoom(true); // открываем всегда в исходном масштабе
  }

  // ---- Блокировка прокрутки страницы ----
  function lockScroll() {
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (sw > 0) document.body.style.paddingRight = sw + "px";
  }

  function unlockScroll() {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }

  // ---- Открытие / закрытие ----
  function open(clicked) {
    lastFocused = document.activeElement;
    show(clicked);
    lockScroll();
    overlay.setAttribute("aria-hidden", "false");
    // Форсируем reflow, чтобы сработал transition появления
    void overlay.offsetWidth;
    overlay.classList.add("is-open");
    document.addEventListener("keydown", onKeydown);
    closeBtn.focus();
  }

  function close() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", onKeydown);
    unlockScroll();
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
    // Сбрасываем src и масштаб после анимации затухания
    window.setTimeout(() => {
      if (!isOpen()) {
        img.removeAttribute("src");
        resetZoom(true);
      }
    }, 300);
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "+" || e.key === "=") {
      zoomByCenter(BTN_STEP);
    } else if (e.key === "-") {
      zoomByCenter(1 / BTN_STEP);
    } else if (e.key === "0") {
      resetZoom();
    }
  }

  // ---- Слушатели ----
  triggers.forEach((el) => {
    el.addEventListener("click", () => open(el));
  });

  closeBtn.addEventListener("click", close);

  zoomInBtn.addEventListener("click", () => zoomByCenter(BTN_STEP));
  zoomOutBtn.addEventListener("click", () => zoomByCenter(1 / BTN_STEP));
  resetBtn.addEventListener("click", () => resetZoom());

  // Колесо мыши — зум к курсору
  overlay.addEventListener(
    "wheel",
    (e) => {
      if (!isOpen()) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
      zoomTo(scale * factor, e.clientX, e.clientY);
    },
    { passive: false }
  );

  // Одиночный клик — тогглер: приблизить в точку / вернуть исходный масштаб.
  // suppressClick гасит клик, оставшийся после перетаскивания (drag), чтобы
  // тащить приближённое фото можно было без ложного отдаления.
  img.addEventListener("click", (e) => {
    if (suppressClick) return;
    e.preventDefault();
    if (scale > 1.001) {
      resetZoom();
    } else {
      zoomTo(CLICK_SCALE, e.clientX, e.clientY);
    }
  });

  // ---- Перетаскивание мышью (pan) ----
  let dragging = false;
  let moved = false;
  let suppressClick = false;
  let dragX = 0;
  let dragY = 0;
  let dragTx = 0;
  let dragTy = 0;

  img.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || scale <= 1.001) return;
    e.preventDefault();
    dragging = true;
    moved = false;
    dragX = e.clientX;
    dragY = e.clientY;
    dragTx = tx;
    dragTy = ty;
    img.classList.add("is-panning");
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    tx = dragTx + (e.clientX - dragX);
    ty = dragTy + (e.clientY - dragY);
    if (Math.abs(e.clientX - dragX) > 3 || Math.abs(e.clientY - dragY) > 3) {
      moved = true;
    }
    clampPan();
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    img.classList.remove("is-panning");
    if (moved) {
      // Гасим последующий click, чтобы перетаскивание не закрыло лайтбокс
      suppressClick = true;
      window.setTimeout(() => (suppressClick = false), 0);
    }
  });

  // Клик по затемнённому фону (но не по изображению/кнопкам)
  overlay.addEventListener("click", (e) => {
    if (suppressClick) return;
    if (e.target === overlay || e.target === stage) close();
  });

  // ---- Сенсорный ввод: pinch-зум двумя пальцами, pan одним ----
  let mode = null; // 'pan' | 'pinch'
  let tStartX = 0;
  let tStartY = 0;
  let panStartTx = 0;
  let panStartTy = 0;
  let pinchDist0 = 0;
  let pinchScale0 = 1;

  function touchDist(t) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  }
  function touchMid(t) {
    return {
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
    };
  }

  stage.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        mode = "pinch";
        pinchDist0 = touchDist(e.touches);
        pinchScale0 = scale;
        img.classList.add("is-panning");
      } else if (e.touches.length === 1 && scale > 1.001) {
        const t = e.touches[0];
        tStartX = t.clientX;
        tStartY = t.clientY;
        mode = "pan";
        panStartTx = tx;
        panStartTy = ty;
        img.classList.add("is-panning");
      }
    },
    { passive: true }
  );

  stage.addEventListener(
    "touchmove",
    (e) => {
      if (mode === "pinch" && e.touches.length === 2) {
        e.preventDefault();
        const m = touchMid(e.touches);
        zoomTo((pinchScale0 * touchDist(e.touches)) / pinchDist0, m.x, m.y);
      } else if (mode === "pan" && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        tx = panStartTx + (t.clientX - tStartX);
        ty = panStartTy + (t.clientY - tStartY);
        clampPan();
        applyTransform();
      }
    },
    { passive: false }
  );

  stage.addEventListener(
    "touchend",
    (e) => {
      if (e.touches.length === 0) {
        mode = null;
        img.classList.remove("is-panning");
      } else if (e.touches.length === 1 && mode === "pinch") {
        // Палец оторвали — переходим из pinch в pan
        mode = "pan";
        const t = e.touches[0];
        tStartX = t.clientX;
        tStartY = t.clientY;
        panStartTx = tx;
        panStartTy = ty;
      }
    },
    { passive: false }
  );
})();
