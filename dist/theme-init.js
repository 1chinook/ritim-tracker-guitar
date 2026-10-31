// Tercihi CSS yüklenmeden uygula: koyu temada sayfa açılırken beyaz parlama olmaz.
(() => {
  let theme;
  try {
    theme = localStorage.getItem("ritim-theme");
  } catch {
    /* Tercih kaydı kapalı olabilir. */
  }
  if (!["dark", "light"].includes(theme)) {
    theme = matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  document.documentElement.dataset.theme = theme;
})();
