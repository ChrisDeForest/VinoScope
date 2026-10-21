// Applies the saved theme before the app renders, so the page never flashes the default theme.
// Loaded by index.html as a file (not inline) so the production CSP can block inline scripts.
(function () {
  try {
    var stored = localStorage.getItem("vinoscope-theme");
    var theme = stored === "cream-terracotta" || stored === "charcoal-gold" ? stored : "dark-burgundy";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark-burgundy");
  }
})();
