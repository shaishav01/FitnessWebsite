// Theme toggle shared by the public site and the admin dashboard.
(function () {
  var root = document.documentElement;
  var buttons = document.querySelectorAll('[data-theme-toggle]');

  function apply(theme, persist) {
    root.dataset.theme = theme;
    if (persist) { try { localStorage.setItem('kinetra-theme', theme); } catch (e) {} }
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(theme === 'dark'));
      b.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0a14' : '#f6f3ff');
    window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      apply(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
    });
  });
  apply(root.dataset.theme, false);
})();
