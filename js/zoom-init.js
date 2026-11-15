/* Компенсация браузерного зума (CSS zoom на <html>).
   Подключается в <head> БЕЗ defer: должен отработать до первого кадра,
   иначе страница сначала рисуется в одном масштабе, а потом «прыгает». */
(function () {
  var ZOOM_KEY = "portfolio_zoom_dpr";
  try {
    var saved = parseFloat(sessionStorage.getItem(ZOOM_KEY) || "0");
    var current = window.devicePixelRatio;
    if (saved && Math.abs(saved - current) > 0.02) {
      document.documentElement.style.zoom = (saved / current).toFixed(4);
    }
    window.addEventListener("beforeunload", function () {
      var cssZoom = parseFloat(document.documentElement.style.zoom || "1");
      sessionStorage.setItem(ZOOM_KEY, String(current * cssZoom));
    });
  } catch (e) {}
})();
