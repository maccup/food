export function layout(title: string, content: string, activeTab?: string) {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#16a34a">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Food">
  <title>${title} - Food</title>

  <link rel="manifest" href="/manifest.json">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/icons/icon-192.svg">

  <link rel="stylesheet" href="/css/framework7-bundle.min.css">
  <link rel="stylesheet" href="/css/framework7-icons.min.css">
  <link rel="stylesheet" href="/css/food-theme.css">

  <script src="/js/framework7-bundle.min.js"></script>
  <script src="/js/htmx.min.js"></script>

  <style>
    :root {
      --f7-theme-color: #16a34a;
      --f7-theme-color-rgb: 22, 163, 74;
      --f7-theme-color-shade: #15803d;
      --f7-theme-color-tint: #22c55e;
      --f7-safe-area-top: env(safe-area-inset-top);
      --f7-safe-area-bottom: env(safe-area-inset-bottom);
      --color-primary: #16a34a;
      --ok: #16a34a;
      --warn: #f59e0b;
      --bad: #ef4444;
      --muted: #6b7280;
    }

    .ios .page-content {
      padding-bottom: calc(var(--f7-safe-area-bottom) + 72px);
    }

    .swipeout-actions-right a.color-blue { background-color: #16a34a; }
    .swipeout-actions-right a.swipeout-delete { background-color: #ef4444; }

    .sheet-modal { --f7-sheet-border-color: transparent; }
    .sheet-modal .sheet-modal-inner { border-radius: 16px 16px 0 0; }

    /* Pasek makro: wartosc wobec celu */
    .macro-row {
      display: grid;
      grid-template-columns: 84px 1fr 96px;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
    }
    .macro-label { font-size: 13px; color: var(--muted); }
    .macro-value { font-size: 13px; text-align: right; font-variant-numeric: tabular-nums; }
    .macro-track { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; position: relative; }
    .macro-fill { height: 100%; border-radius: 4px; }
    .macro-fill.ok { background: var(--ok); }
    .macro-fill.warn { background: var(--warn); }
    .macro-fill.bad { background: var(--bad); }
    .macro-target-mark {
      position: absolute; top: -2px; bottom: -2px; width: 2px;
      background: rgba(0,0,0,.35);
    }

    /* Znaczniki przy posilku */
    .flag {
      display: inline-block;
      font-size: 11px;
      line-height: 1;
      padding: 4px 7px;
      border-radius: 999px;
      margin: 2px 4px 2px 0;
      font-weight: 600;
    }
    .flag.forbidden { background: #fee2e2; color: #b91c1c; }
    .flag.limit { background: #fef3c7; color: #92400e; }
    .flag.prefer { background: #dcfce7; color: #15803d; }
    .flag.info { background: #e5e7eb; color: #374151; }

    /* Okno jedzenia */
    .sitting-head {
      display: flex; align-items: baseline; justify-content: space-between;
      padding: 14px 16px 6px;
    }
    .sitting-time { font-size: 17px; font-weight: 700; }
    .sitting-gap { font-size: 12px; color: var(--muted); }

    .meal-skipped { opacity: .45; }
    .meal-skipped .item-title { text-decoration: line-through; }

    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    .touch-target { min-height: 44px; min-width: 44px; }

    .htmx-request .htmx-indicator { display: inline-flex !important; }
    .htmx-indicator { display: none; }

    #page-loader {
      position: fixed; top: 0; left: 0; right: 0; height: 3px;
      background: var(--f7-theme-color); z-index: 99999;
      transform: scaleX(0); transform-origin: left; transition: transform .1s;
    }
    #page-loader.active { animation: loading-bar 2s ease-out forwards; }
    @keyframes loading-bar {
      0% { transform: scaleX(0); }
      50% { transform: scaleX(.7); }
      100% { transform: scaleX(.95); }
    }

    /* Dolna nawigacja */
    .tabbar-bottom {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 500;
      display: grid; grid-template-columns: repeat(5, 1fr);
      background: var(--f7-bars-bg-color, #fff);
      border-top: 1px solid rgba(0,0,0,.12);
      padding-bottom: var(--f7-safe-area-bottom);
    }
    .dark-mode .tabbar-bottom { background: #1c1c1d; border-top-color: rgba(255,255,255,.15); }
    .tabbar-bottom a {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 2px; padding: 8px 0 6px; font-size: 10px; color: var(--muted); text-decoration: none;
    }
    .tabbar-bottom a.active { color: var(--f7-theme-color); font-weight: 700; }
    .tabbar-bottom .tab-icon { font-size: 18px; line-height: 1; }
  </style>
</head>
<body>
  <script>
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark-mode');
    }
    window.esc = function(s) { return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); };
  </script>

  <div id="app">
    ${content}
  </div>

  ${activeTab ? tabbar(activeTab) : ''}

  <div id="page-loader"></div>

  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(function(reg) {
        if (reg) { reg.update().catch(function() {}); }
      });
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(function() {});
    }
  </script>

  <script>
    document.body.addEventListener('showError', function(e) { alert(e.detail.value); });

    window.toggleTheme = function() {
      var html = document.documentElement;
      var isDark = html.classList.toggle('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      var btns = document.querySelectorAll('.theme-toggle');
      for (var i = 0; i < btns.length; i++) { btns[i].textContent = isDark ? '☀️' : '🌙'; }
    };

    document.addEventListener('DOMContentLoaded', function() {
      var isDark = document.documentElement.classList.contains('dark-mode');
      var btns = document.querySelectorAll('.theme-toggle');
      for (var i = 0; i < btns.length; i++) { btns[i].textContent = isDark ? '☀️' : '🌙'; }

      document.addEventListener('click', function(e) {
        var link = e.target.closest ? e.target.closest('a[href]') : null;
        if (link && link.href && link.href.indexOf(location.origin) === 0) {
          var loader = document.getElementById('page-loader');
          if (loader) loader.classList.add('active');
        }
      });
    });

    window.addEventListener('pageshow', function() {
      var loader = document.getElementById('page-loader');
      if (loader) loader.classList.remove('active');
    });
  </script>
</body>
</html>`;
}

const TABS: Array<{ href: string; icon: string; label: string; key: string }> = [
  { href: '/', icon: '🍽️', label: 'Dziś', key: 'today' },
  { href: '/week', icon: '📊', label: 'Tydzień', key: 'week' },
  { href: '/log', icon: '➕', label: 'Dopisz', key: 'log' },
  { href: '/suplementy', icon: '💊', label: 'Suple', key: 'supplements' },
  { href: '/restrictions', icon: '🚫', label: 'Wykluczenia', key: 'restrictions' },
];

function tabbar(active: string) {
  return `<nav class="tabbar-bottom">
    ${TABS.map(
      (t) => `<a href="${t.href}" class="${t.key === active ? 'active' : ''}">
      <span class="tab-icon">${t.icon}</span>
      <span>${t.label}</span>
    </a>`
    ).join('')}
  </nav>`;
}
