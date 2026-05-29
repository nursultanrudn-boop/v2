(function () {
  const GREETINGS = [
    "Привет",
    "Хэлло",
    "Бонжур",
    "Хей",
    "Мерхаба",
    "Нихао",
    "Халло",
    "Салют",
  ];

  const CHARS = "!<>-_\\/[]{}=+*^?#@$%0123456789abcdefghijklmnopqrstuvwxyz";
  const DISPLAY_MS = 2200; // пауза перед следующим scramble

  const el = document.querySelector(".greeting-rotator__word");
  if (!el) return;

  // Упрощённый режим без анимации
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let i = 0;
    setInterval(() => {
      i = (i + 1) % GREETINGS.length;
      el.textContent = GREETINGS[i];
    }, DISPLAY_MS);
    return;
  }

  let rafId = null;
  let frame = 0;
  let queue = [];
  let currentText = GREETINGS[0];
  let wordIndex = 0;

  function randomChar() {
    return CHARS[Math.floor(Math.random() * CHARS.length)];
  }

  function scrambleTo(newText) {
    return new Promise((resolve) => {
      const oldText = currentText;
      const len = Math.max(oldText.length, newText.length);
      queue = [];

      for (let i = 0; i < len; i++) {
        const from = oldText[i] || "";
        const to = newText[i] || "";
        const start = Math.floor(Math.random() * 8);
        const end = start + Math.floor(Math.random() * 14) + 8;
        queue.push({ from, to, start, end, char: "" });
      }

      cancelAnimationFrame(rafId);
      frame = 0;

      function tick() {
        let html = "";
        let done = 0;

        for (let i = 0; i < queue.length; i++) {
          const item = queue[i];

          if (frame >= item.end) {
            done++;
            html += item.to;
          } else if (frame >= item.start) {
            if (!item.char || Math.random() < 0.28) {
              item.char = randomChar();
            }
            html += `<span class="greeting-scramble-char">${item.char}</span>`;
          } else {
            html += item.from;
          }
        }

        el.innerHTML = html;

        if (done === queue.length) {
          currentText = newText;
          resolve();
        } else {
          frame++;
          rafId = requestAnimationFrame(tick);
        }
      }

      tick();
    });
  }

  async function cycle() {
    for (;;) {
      await new Promise((r) => setTimeout(r, DISPLAY_MS));
      wordIndex = (wordIndex + 1) % GREETINGS.length;
      await scrambleTo(GREETINGS[wordIndex]);
    }
  }

  cycle();
})();
