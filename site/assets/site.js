// Theme: follow the system until the visitor picks one with the toggle, then remember it.
// Loaded in <head> (not deferred) so the theme is set before the first paint. The key is
// namespaced because the beta games share this origin's localStorage.
(function () {
  var KEY = 'monkotorix-theme';
  var root = document.documentElement;
  var mq = window.matchMedia('(prefers-color-scheme: dark)');

  function picked() {
    try { var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; } catch (e) { return null; }
  }
  // Keep the browser's own UI colour in step with the page, including after a manual switch.
  function paintChrome() {
    var c = root.getAttribute('data-theme') === 'dark' ? '#0c1124' : '#f5edda';
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', c);
  }
  function sync() {
    paintChrome();
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var dark = root.getAttribute('data-theme') === 'dark';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    btn.setAttribute('title', (dark ? 'Switch to light theme' : 'Switch to dark theme') + ' (remembered on this device)');
  }

  root.setAttribute('data-theme', picked() || (mq.matches ? 'dark' : 'light'));
  paintChrome();
  if (mq.addEventListener) {
    mq.addEventListener('change', function (e) {
      if (picked()) return;
      root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      sync();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem(KEY, next); } catch (e) { }
        sync();
      });
    }
    sync();
  });
})();
