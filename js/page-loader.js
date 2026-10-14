/* =============================================
   PelotonHub — page-loader.js
   Loading screen shown while a page opens and while
   leaving for another page (customer pages only). A
   classic (non-module) script in <head>, so it covers
   the page before anything paints.

   - Arriving: the screen stays until everything the page
     shows first is in place: each script that loads content
     takes a hold (phLoaderHold() returns a release function)
     and releases it once that content is on screen — main.js
     for the signed-in state, page scripts for products,
     events, cart, orders… Then fonts and the images on the
     first screen get a moment to load, so nothing jumps
     (e.g. the footer being pushed down) after it lifts.
     MAX_WAIT is the safety net for very slow connections.
   - Leaving: tapping a link to another page shows it
     again (after a short delay, so fast hops don't flash).
   ============================================= */
(function () {
  var root = document.documentElement;
  var MAX_WAIT = 7000;     // never keep someone waiting longer than this
  var SETTLE_MAX = 1500;   // longest wait for fonts/images once the content is in

  var wheel = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E" +
    "%3Ccircle cx='32' cy='32' r='27' fill='none' stroke='%2314100c' stroke-width='5'/%3E" +
    "%3Ccircle cx='32' cy='32' r='21' fill='none' stroke='%23cebfa9' stroke-width='1.5'/%3E" +
    "%3Cg stroke='%2314100c' stroke-width='1.6' stroke-linecap='round'%3E" +
    "%3Cline x1='32' y1='32' x2='32' y2='11'/%3E%3Cline x1='32' y1='32' x2='50.2' y2='42.5'/%3E%3Cline x1='32' y1='32' x2='13.8' y2='42.5'/%3E" +
    "%3Cline x1='32' y1='32' x2='32' y2='53'/%3E%3Cline x1='32' y1='32' x2='50.2' y2='21.5'/%3E%3Cline x1='32' y1='32' x2='13.8' y2='21.5'/%3E%3C/g%3E" +
    "%3Ccircle cx='32' cy='32' r='5' fill='%23ff4d23'/%3E%3C/svg%3E";

  // Wordmark under the wheel (Georgia stands in for Fraunces: web fonts can't load inside an image)
  var mark = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 40'%3E" +
    "%3Ctext x='100' y='28' text-anchor='middle' font-family='Georgia,serif' font-size='24' font-weight='600' fill='%2314100c'%3EPeloton" +
    "%3Ctspan fill='%23ff4d23' font-style='italic'%3EHub%3C/tspan%3E%3C/text%3E%3C/svg%3E";

  var css =
    'html.pl::before{content:"";position:fixed;inset:0;z-index:99998;background:var(--paper,#fbf6ee) url("' + mark + '") no-repeat 50% calc(50% + 58px)/170px 34px;transition:opacity .28s ease;}' +
    'html.pl::after{content:"";position:fixed;left:50%;top:50%;width:58px;height:58px;margin:-40px 0 0 -29px;z-index:99999;' +
      'background:url("' + wheel + '") center/contain no-repeat;opacity:0;' +
      'animation:pl-in .25s ease .25s forwards,pl-spin 1s linear infinite;transition:opacity .2s ease;}' +
    /* leaving: the whole screen fades in, but only if the next page is slow to arrive */
    'html.pl.pl-leave::before{opacity:0;animation:pl-in .22s ease .12s forwards;}' +
    'html.pl.pl-leave::after{animation:pl-in .2s ease .3s forwards,pl-spin 1s linear infinite;}' +
    /* done: fade out and let taps through straight away */
    'html.pl.pl-done::before,html.pl.pl-done::after{opacity:0!important;pointer-events:none;}' +
    '@keyframes pl-in{to{opacity:1;}}' +
    '@keyframes pl-spin{to{transform:rotate(360deg);}}' +
    '@media (prefers-reduced-motion:reduce){html.pl::after{animation:pl-in .2s ease .25s forwards;}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var holds = 0, domReady = false, settling = false, timer = null, cleanup = null;

  function done() {
    if (!root.classList.contains('pl') || root.classList.contains('pl-done')) return;
    clearTimeout(timer);
    settling = false;
    root.classList.add('pl-done');
    cleanup = setTimeout(function () { root.classList.remove('pl', 'pl-done', 'pl-leave'); }, 320);
  }
  function show() {
    clearTimeout(cleanup);
    root.classList.remove('pl-done');
    root.classList.add('pl', 'pl-leave');
    // If the browser stays on this page after all (download, blocked link), don't leave it covered
    clearTimeout(timer);
    timer = setTimeout(done, 8000);
  }

  // Fonts and the images on the first screen, so the page doesn't reflow right after it appears
  function settle() {
    var waits = [];
    if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
    var vh = window.innerHeight;
    Array.prototype.forEach.call(document.images, function (img) {
      if (img.complete) return;
      var r = img.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh || r.width === 0) return;   // off screen: lazy images can come later
      waits.push(new Promise(function (ok) { img.addEventListener('load', ok); img.addEventListener('error', ok); }));
    });
    var cap = new Promise(function (ok) { setTimeout(ok, SETTLE_MAX); });
    return Promise.race([Promise.all(waits), cap]).then(function () {
      // two frames: the browser has laid out and painted the final page before it's revealed
      // (timer fallback: background tabs don't run animation frames)
      return new Promise(function (ok) { requestAnimationFrame(function () { requestAnimationFrame(ok); }); setTimeout(ok, 120); });
    });
  }
  function maybeFinish() {
    if (holds > 0 || !domReady || settling || !root.classList.contains('pl') || root.classList.contains('pl-leave')) return;
    settling = true;
    settle().then(function () { if (settling && holds === 0) done(); else settling = false; });
  }

  // A script that fills the page calls  var ready = phLoaderHold();  and later  ready();
  window.phLoaderHold = function () {
    holds++;
    var used = false;
    return function release() {
      if (used) return;
      used = true; holds--;
      maybeFinish();
    };
  };
  window.phLoaderDone = done;     // force it closed
  window.phLoaderShow = show;

  // Arriving
  root.classList.add('pl');
  timer = setTimeout(done, MAX_WAIT);
  document.addEventListener('DOMContentLoaded', function () {
    // module scripts have run by now, so every hold has been taken; give a tick for async starts
    setTimeout(function () { domReady = true; maybeFinish(); }, 0);
  });

  // Back/forward restores the old page from memory: never show it covered
  window.addEventListener('pageshow', function (e) { if (e.persisted) { holds = 0; root.classList.add('pl'); done(); } });

  // Leaving via a plain link. Runs on window (after the page's own handlers), so links
  // a page already handled (sign-in window, main.js page fade) are skipped here.
  window.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(mailto|tel|javascript):/i.test(href)) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    show();
  });
})();
