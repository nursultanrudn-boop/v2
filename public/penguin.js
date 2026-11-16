// penguin.js — пиксельный пингвин, который бегает за курсором.
// Логика поведения повторяет oneko.js (https://github.com/adryd325/oneko.js, MIT).
// Подключение: тег script с атрибутами src="penguin.js" и data-sprite="penguin.png"
(function penguin() {
  if (window.__penguinLoaded) return; // защита от второго пингвина
  window.__penguinLoaded = true;

  const script = document.currentScript;
  const SPRITE_URL = (script && script.dataset.sprite) || "penguin.png";
  const SIZE = 32;     // размер клетки спрайт-листа, px
  const SPEED = 10;    // сколько px пингвин проходит за один тик
  const TICK = 100;    // длительность тика, мс (10 кадров в секунду)
  const STOP_AT = 1;   // на каком расстоянии от своей точки у курсора он останавливается
  // Он прилипает к точке клика курсора с той стороны, с которой подбежал:
  // край его тела касается этой точки. Тело в кадре 32×32 занимает примерно
  // x 3–28, y 6–30, то есть его центр на 2 px ниже центра клетки, радиус около 12 px.
  const BODY_DY = 2, BODY_R = 12;
  const STORAGE_KEY = "penguin-enabled";

  // Координаты кадров в листе 256×128: [колонка, ряд]
  const SPRITES = {
    idle: [[0, 0]],
    alert: [[1, 0]],
    tired: [[2, 0]],
    sleeping: [[3, 0], [4, 0]],
    scratchSelf: [[5, 0], [6, 0]],
    scratchWallN: [[0, 1], [4, 1]],
    scratchWallS: [[1, 1], [5, 1]],
    scratchWallW: [[2, 1], [6, 1]],
    scratchWallE: [[3, 1], [7, 1]],
    N: [[0, 2], [0, 3]],
    NE: [[1, 2], [1, 3]],
    E: [[2, 2], [2, 3]],
    SE: [[3, 2], [3, 3]],
    S: [[4, 2], [4, 3]],
    SW: [[5, 2], [5, 3]],
    W: [[6, 2], [6, 3]],
    NW: [[7, 2], [7, 3]],
  };

  let x = 32, y = 32;          // центр пингвина
  let mouseX = 0, mouseY = 0;  // последняя позиция курсора
  let frame = 0;               // счётчик тиков
  let idleTime = 0;            // сколько тиков стоит на месте
  let idleAnim = null;         // текущая анимация простоя
  let idleFrame = 0;
  let lastTick = 0;

  // Только десктоп: ширина от 1024px и обычная мышь. На телефонах и планшетах
  // пингвина, кнопки и особого курсора нет.
  const desktopMq = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");

  // Пока пингвин включён, курсор — гора; когда выключен — обычный.
  const cursorBase = SPRITE_URL.replace(/penguin.png$/, "cursor-mountain");
  const cursorStyle = document.createElement("style");
  cursorStyle.textContent =
    `html.penguin-on, html.penguin-on * { cursor: image-set(url("${cursorBase}28.png") 1x, url("${cursorBase}56.png") 2x) 13 4, auto !important; }`;
  document.head.appendChild(cursorStyle);

  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    width: SIZE + "px",
    height: SIZE + "px",
    position: "fixed",
    pointerEvents: "none",
    imageRendering: "pixelated",
    backgroundImage: `url("${SPRITE_URL}")`,
    left: x - SIZE / 2 + "px",
    top: y - SIZE / 2 + "px",
    zIndex: 2147483647,
    opacity: "0",
  });
  document.body.appendChild(el);

  // Падение: пингвин влетает сверху из-за края окна, ускоряется под действием «гравитации»
  // и пару раз подпрыгивает при приземлении. Стартует чуть позже контента.
  let dropping = false;
  let dropOffset = 0; // смещение вверх от своего места, px (<= 0)
  function startDrop() {
    dropping = true;
    dropOffset = -(Math.max(y, 0) + SIZE + 40);
    let v = 0, bounces = 0, last = performance.now();
    el.style.opacity = "1";
    setSprite("alert", 0);
    (function step(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      v += 2600 * dt;          // ускорение свободного падения, px/с²
      dropOffset += v * dt;
      if (dropOffset >= 0) {
        dropOffset = 0;
        if (bounces < 2 && v > 180) {
          v = -v * 0.32;       // отскок теряет энергию
          bounces += 1;
        } else {
          dropping = false;
          el.style.translate = "0 0";
          return;
        }
      }
      el.style.translate = "0 " + dropOffset + "px";
      requestAnimationFrame(step);
    })(last);
  }
  setTimeout(startDrop, 700);

  // --- Кнопка включения и выключения (круглая, в левом нижнем углу) ---
  // По умолчанию пингвин включён. Выбор запоминается в localStorage.
  // Если в системе включено «уменьшить движение», по умолчанию он выключен.
  let enabled = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) enabled = saved === "1";
  } catch (e) {}

  const btn = document.createElement("button");
  btn.type = "button";
  Object.assign(btn.style, {
    position: "fixed",
    left: "32px",
    bottom: "32px",
    width: "40px",
    height: "40px",
    padding: "0",
    lineHeight: "0",
    borderRadius: "12px",
    border: "1px solid var(--stroke-divider, rgba(130,147,171,.2))",
    backgroundColor: "var(--bg-accent, #fff)",
    color: "var(--fg-secondary, #435165)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    boxShadow: "var(--shadow-dock, 0 2px 6px rgba(0,0,0,.15))",
    transition: "color .15s",
    zIndex: 2147483647,
  });
  btn.addEventListener("mouseenter", () => { btn.style.color = "var(--fg-primary, #0a0c0f)"; });
  btn.addEventListener("mouseleave", () => { btn.style.color = "var(--fg-secondary, #435165)"; });

  // Иконки кнопки — наш пиксельный пингвин. Включён: сидит и смотрит.
  // Выключен: спит на фоне горы (той же, что курсор).
  const spriteDiv = (col, extra) =>
    `<div style="position:absolute;width:${SIZE}px;height:${SIZE}px;image-rendering:pixelated;background-image:url('${SPRITE_URL}');background-position:${-col * SIZE}px 0;${extra}"></div>`;
  // Тело пингвина в кадре лежит ниже центра клетки, поэтому поднимаем его на 2 px и чуть уменьшаем.
  const ICON_ON =
    '<div style="position:relative;width:32px;height:32px">' + spriteDiv(0, "left:0;top:-2px;transform:scale(.875);") + "</div>";
  // Выключен: гора по центру, перед ней отдельно лежит спящий пингвин (чуть ниже и поверх).
  const ICON_OFF =
    '<div style="position:relative;width:32px;height:32px">' +
    `<img src="${cursorBase}56.png" alt="" style="position:absolute;left:2px;top:1px;width:28px;height:28px">` +
    spriteDiv(3, "left:0;top:-1px;transform:scale(.8);") + "</div>";
  document.body.appendChild(btn);

  // На узких экранах нижняя панель занимает всю ширину, поэтому кнопка встаёт над ней.
  const narrow = window.matchMedia("(max-width: 767px)");
  function placeBtn() {
    btn.style.left = narrow.matches ? "16px" : "32px";
    btn.style.bottom = narrow.matches ? "80px" : "32px";
  }
  placeBtn();
  narrow.addEventListener("change", placeBtn);

  function applyEnabled() {
    const active = enabled && desktopMq.matches;
    el.style.display = active ? "block" : "none";
    btn.style.display = desktopMq.matches ? "grid" : "none";
    document.documentElement.classList.toggle("penguin-on", active);
    btn.innerHTML = enabled ? ICON_ON : ICON_OFF;
    btn.setAttribute("aria-pressed", String(enabled));
    const label = enabled ? "Выключить пингвина" : "Включить пингвина";
    btn.setAttribute("aria-label", label);
    btn.title = label;
    if (active && !loopRunning) {
      loopRunning = true;
      requestAnimationFrame(loop);
    }
  }
  let loopRunning = false;
  desktopMq.addEventListener("change", applyEnabled);

  btn.addEventListener("click", () => {
    enabled = !enabled;
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch (e) {}
    applyEnabled();
  });

  // Пока курсор не двигали, пингвин «появляется» на месте и едет вместе со страницей:
  // на главной — справа от заголовка «Привет, я Султан», на страницах кейсов —
  // над главной картинкой по центру колонки. После первого движения мыши
  // бежит за курсором как обычно.
  let moved = false;
  // Сдвиг элемента из-за transform у него и его предков (анимация появления контента):
  // вычитаем его, чтобы пингвин считал место по итоговой вёрстке.
  function transformShift(node) {
    let dx = 0, dy = 0;
    for (let n = node; n && n !== document.documentElement; n = n.parentElement) {
      const t = getComputedStyle(n).transform;
      if (t && t !== "none") {
        const m = new DOMMatrixReadOnly(t);
        dx += m.e;
        dy += m.f;
      }
    }
    return { dx, dy };
  }
  function homePos() {
    // Правый край колонки контента по сетке сайта
    const area = document.querySelector(".main-area");
    if (!area) return null;
    const ar = area.getBoundingClientRect();
    const gridRight = ar.right - parseFloat(getComputedStyle(area).paddingRight || "0");
    const px = gridRight - SIZE / 2;

    const title = document.querySelector(".profile-head__title");
    if (title) {
      const r = title.getBoundingClientRect();
      if (!r.height) return null;
      const sh = transformShift(title);
      return { x: px, y: r.top - sh.dy + r.height / 2 };
    }
    const hero = document.querySelector(".case2-hero");
    if (hero) {
      const r = hero.getBoundingClientRect();
      const sh = transformShift(hero);
      return { x: px, y: r.top - sh.dy - 24 };
    }
    return null;
  }

  document.addEventListener("mousemove", (e) => {
    moved = true;
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function setSprite(name, n) {
    const frames = SPRITES[name];
    const [col, row] = frames[n % frames.length];
    el.style.backgroundPosition = `${-col * SIZE}px ${-row * SIZE}px`;
  }

  // --- Поведение, когда курсор стоит на месте ---
  // Через 2–3 секунды пингвин зевает и засыпает, потом просыпается («удивился»),
  // немного сидит, чешется или осматривается, и снова ложится спать — по кругу.
  let needNext = true;  // при новой остановке заново планируем первое действие
  let nextAt = 0;       // на каком idleTime начнётся следующее действие
  let idleLen = 0;      // длительность текущей анимации, в тиках
  let sleptBefore = false;

  function rand(a, b) {
    return a + Math.floor(Math.random() * (b - a + 1));
  }

  function resetIdle() {
    idleAnim = null;
    idleFrame = 0;
    needNext = true;
    sleptBefore = false;
  }

  function startIdleAnim(name, len) {
    idleAnim = name;
    idleLen = len;
    idleFrame = 0;
  }

  function pickIdleAnim() {
    // Первый раз после остановки — всегда засыпает
    if (!sleptBefore) {
      sleptBefore = true;
      return startIdleAnim("sleeping", rand(60, 110)); // 6–11 секунд сна
    }
    const options = ["sleeping", "sleeping", "scratchSelf", "look"];
    if (x < 32) options.push("scratchWallW");
    if (y < 32) options.push("scratchWallN");
    if (x > window.innerWidth - 32) options.push("scratchWallE");
    if (y > window.innerHeight - 32) options.push("scratchWallS");
    const name = options[Math.floor(Math.random() * options.length)];
    if (name === "sleeping") startIdleAnim("sleeping", rand(60, 110));
    else if (name === "look") startIdleAnim("look", rand(12, 20));
    else startIdleAnim(name, rand(14, 24));
  }

  function idle() {
    idleTime += 1;

    if (needNext) {
      needNext = false;
      nextAt = idleTime + rand(20, 30); // 2–3 секунды на месте
    }

    if (!idleAnim && idleTime >= nextAt) pickIdleAnim();

    if (!idleAnim) {
      setSprite("idle", 0);
      return;
    }

    if (idleAnim === "sleeping") {
      if (idleFrame < 8) setSprite("tired", 0);                 // зевает
      else setSprite("sleeping", Math.floor(idleFrame / 4));    // спит
    } else if (idleAnim === "wake") {
      setSprite("alert", 0);                                    // проснулся
    } else if (idleAnim === "look") {
      // осматривается: то «удивился», то сидит
      setSprite(Math.floor(idleFrame / 5) % 2 === 0 ? "alert" : "idle", 0);
    } else {
      setSprite(idleAnim, idleFrame);                           // чешется
    }

    idleFrame += 1;
    if (idleFrame >= idleLen) {
      if (idleAnim === "sleeping") {
        startIdleAnim("wake", 5);                               // просыпается
      } else {
        idleAnim = null;
        idleFrame = 0;
        nextAt = idleTime + rand(25, 50);                       // пауза 2.5–5 сек
      }
    }
  }

  function tick() {
    frame += 1;
    if (!moved) {
      const h = homePos();
      if (h) {
        x = h.x;
        y = h.y;
        el.style.left = x - SIZE / 2 + "px";
        el.style.top = y - SIZE / 2 + "px";
      }
      if (dropping) return;
      idle();
      return;
    }
    // Направление «от точки клика к пингвину» — та сторона, с которой он подбежал
    let vx = x - mouseX;
    let vy = y + BODY_DY - mouseY;
    let vd = Math.hypot(vx, vy);
    if (vd < 1) { vx = 1; vy = 0; vd = 1; }
    const dx = x - (mouseX + (vx / vd) * BODY_R);
    const dy = y - (mouseY + (vy / vd) * BODY_R - BODY_DY);
    const dist = Math.hypot(dx, dy);

    if (dist < STOP_AT) {
      idle();
      return;
    }

    resetIdle();

    // Если до этого стоял — сначала пара кадров «удивился»
    if (idleTime > 1) {
      setSprite("alert", 0);
      idleTime = Math.min(idleTime, 7) - 1;
      return;
    }

    // Одно из 8 направлений
    let dir = "";
    if (dy / dist > 0.5) dir += "N";
    if (dy / dist < -0.5) dir += "S";
    if (dx / dist > 0.5) dir += "W";
    if (dx / dist < -0.5) dir += "E";
    setSprite(dir, frame);

    const step = Math.min(SPEED, dist); // обычная скорость, последний шаг — точно в цель
    x -= (dx / dist) * step;
    y -= (dy / dist) * step;
    x = Math.min(Math.max(16, x), window.innerWidth - 16);
    y = Math.min(Math.max(16, y), window.innerHeight - 16);

    el.style.left = x - SIZE / 2 + "px";
    el.style.top = y - SIZE / 2 + "px";
  }

  function loop(t) {
    if (!el.isConnected || !enabled || !desktopMq.matches) { loopRunning = false; return; }
    if (t - lastTick > TICK) {
      lastTick = t;
      tick();
    }
    requestAnimationFrame(loop);
  }

  setSprite("idle", 0);
  applyEnabled();
})();
