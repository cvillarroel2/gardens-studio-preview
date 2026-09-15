/* MENU ACCENT PICKER (2026-09-14, review tooling): try shades of green for
 * the header menu's hover / active colour (the top bar + the light wash)
 * instead of the poppy red. Choice is stamped as data-accent on <html>,
 * remembered in localStorage, and the CSS tokens --accent / --accent-wash
 * follow it. Separate file because the page's CSP is script-src 'self'. */
(function () {
  var OPTIONS = [
    { id: 'sage',   label: 'Soft sage' },
    { id: 'moss',   label: 'Moss' },
    { id: 'olive',  label: 'Olive' },
    { id: 'forest', label: 'Forest' },
    { id: 'leaf',   label: 'Leaf' },
    { id: 'poppy',  label: 'Poppy (original)' }
  ];
  var KEY = 'gardens-menu-accent';
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  var current = OPTIONS.some(function (o) { return o.id === saved; }) ? saved : OPTIONS[0].id;
  document.documentElement.setAttribute('data-accent', current);

  function build() {
    var wrap = document.createElement('div');
    wrap.className = 'accent-pick';
    wrap.setAttribute('aria-label', 'Menu accent');
    var title = document.createElement('span');
    title.className = 'accent-pick-title';
    title.textContent = 'Menu accent';
    wrap.appendChild(title);
    OPTIONS.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = o.label;
      b.setAttribute('data-accent-id', o.id);
      if (o.id === current) b.classList.add('on');
      b.addEventListener('click', function () {
        current = o.id;
        document.documentElement.setAttribute('data-accent', o.id);
        try { localStorage.setItem(KEY, o.id); } catch (e) {}
        var bs = wrap.querySelectorAll('button');
        for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i] === b);
      });
      wrap.appendChild(b);
    });
    document.body.appendChild(wrap);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
