(function () {
  const ZOOM_KEY = "portfolio_zoom_dpr";

  const saved = parseFloat(sessionStorage.getItem(ZOOM_KEY) || "0");
  const current = window.devicePixelRatio;

  if (saved && Math.abs(saved - current) > 0.02) {
    document.documentElement.style.zoom = (saved / current).toFixed(4);
  }

  window.addEventListener("beforeunload", () => {
    const cssZoom = parseFloat(document.documentElement.style.zoom || "1");
    sessionStorage.setItem(ZOOM_KEY, String(current * cssZoom));
  });
})();

(function () {
  const DOCK_INTRO_SEEN_KEY = "portfolio_dock_intro_seen";

  const wrap = document.querySelector(".dock-wrap");
  if (!wrap) return;

  const hasSeenIntro = sessionStorage.getItem(DOCK_INTRO_SEEN_KEY) === "1";
  if (!hasSeenIntro) {
    wrap.classList.add("dock-wrap--intro");
    sessionStorage.setItem(DOCK_INTRO_SEEN_KEY, "1");
  }

  const DOCK_PROGRESSIVE_LAYERS = [
    { blur: 44, mask: "linear-gradient(to top, transparent 0%, black 0%, black 10%, transparent 27%)" },
    { blur: 32, mask: "linear-gradient(to top, transparent 0%, black 10%, black 20%, transparent 37%)" },
    { blur: 16, mask: "linear-gradient(to top, transparent 3%, black 20%, black 30%, transparent 47%)" },
    { blur: 12, mask: "linear-gradient(to top, transparent 13%, black 30%, black 40%, transparent 57%)" },
    { blur: 8,  mask: "linear-gradient(to top, transparent 23%, black 40%, black 50%, transparent 67%)" },
    { blur: 4,  mask: "linear-gradient(to top, transparent 33%, black 50%, black 60%, transparent 77%)" },
    { blur: 2,  mask: "linear-gradient(to top, transparent 43%, black 60%, black 70%, transparent 87%)" },
    { blur: 1,  mask: "linear-gradient(to top, transparent 53%, black 70%, black 80%, transparent 97%)" },
  ];

  const DESKTOP_MQ = "(min-width: 1025px)";

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function blurWanted() {
    if (prefersReducedMotion()) return false;
    if (!window.matchMedia) return false;
    return window.matchMedia(DESKTOP_MQ).matches;
  }

  function buildBlur() {
    const el = document.createElement("div");
    el.className = "dock-progressive-bottom";
    el.setAttribute("aria-hidden", "true");
    DOCK_PROGRESSIVE_LAYERS.forEach(({ blur, mask }) => {
      const layer = document.createElement("div");
      layer.className = "dock-progressive-blur-layer";
      layer.style.backdropFilter = "blur(" + blur + "px)";
      layer.style.webkitBackdropFilter = "blur(" + blur + "px)";
      layer.style.maskImage = mask;
      layer.style.webkitMaskImage = mask;
      el.appendChild(layer);
    });
    return el;
  }

  let progressiveBottom = blurWanted() ? buildBlur() : null;
  if (progressiveBottom) {
    document.body.classList.add("has-dock-progressive-blur");
    wrap.parentNode.insertBefore(progressiveBottom, wrap);
  }

  function syncBlur() {
    const want = blurWanted();
    if (want && !progressiveBottom) {
      progressiveBottom = buildBlur();
      wrap.parentNode.insertBefore(progressiveBottom, wrap);
      document.body.classList.add("has-dock-progressive-blur");
    } else if (!want && progressiveBottom) {
      progressiveBottom.remove();
      progressiveBottom = null;
      document.body.classList.remove("has-dock-progressive-blur");
    }
  }

  if (window.matchMedia) {
    const mql = window.matchMedia(DESKTOP_MQ);
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", syncBlur);
    } else if (typeof mql.addListener === "function") {
      mql.addListener(syncBlur);
    }
  }
})();
