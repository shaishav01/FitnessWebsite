// Runs before first paint (loaded synchronously in <head>) so the saved theme never flashes.
(function () {
  var theme;
  try { theme = localStorage.getItem('kinetra-theme'); } catch (e) {}
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.add('js');
})();
