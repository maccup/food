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

    /* Szary tekst pomocniczy z trybu jasnego jest nieczytelny na czarnym tle. */
    html.dark-mode {
      --muted: #9ca3af;
      --ok: #22c55e;
      --warn: #fbbf24;
      --bad: #f87171;
    }
    .dark-mode .macro-track { background: #3f3f46; }
    .dark-mode .macro-target-mark { background: rgba(255,255,255,.5); }
    .dark-mode .flag.info { background: #3f3f46; color: #e5e7eb; }
    .dark-mode .flag.forbidden { background: #7f1d1d; color: #fecaca; }
    .dark-mode .flag.limit { background: #713f12; color: #fde68a; }
    .dark-mode .flag.prefer { background: #14532d; color: #bbf7d0; }

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

    /* Panel kontrolny */
    .panel {
      margin: 8px 12px 4px; padding: 12px 14px 10px;
      background: var(--f7-bars-bg-color, #fff);
      border-radius: 14px; box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    .dark-mode .panel { background: #1c1c1d; box-shadow: 0 1px 3px rgba(0,0,0,.4); }
    .tiles { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; text-align: center; }
    .tile-value { font-size: 19px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
    .tile-label { font-size: 10px; color: var(--muted); margin-top: 1px; }
    .panel-row {
      display: flex; justify-content: space-between; align-items: center; gap: 10px;
      padding: 8px 0; border-top: 1px solid rgba(0,0,0,.07);
    }
    .dark-mode .panel-row { border-top-color: rgba(255,255,255,.1); }
    .panel-row:first-child { border-top: 0; }
    .panel-row-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }
    .panel-row-main { font-size: 15px; font-weight: 600; margin-top: 1px; }
    .panel-row-side { font-size: 13px; color: var(--muted); text-align: right; white-space: nowrap; }
    .panel-note { font-size: 11px; color: var(--warn); margin-top: 6px; }
    .panel-alert {
      margin-top: 8px; padding: 8px 10px; border-radius: 10px;
      background: #fee2e2; color: #b91c1c; font-size: 13px;
    }
    .dark-mode .panel-alert { background: #7f1d1d; color: #fecaca; }
    .panel-actions { display: flex; gap: 8px; margin-top: 10px; }
    .panel-actions .button { flex: 1; min-height: 40px; }

    /* Zwijane karty: bez domyslnego trojkata Safari */
    details > summary::-webkit-details-marker { display: none; }
    details > summary { list-style: none; }

    /* Kalendarz */
    .cal-head {
      display: grid; grid-template-columns: repeat(7, 1fr);
      font-size: 11px; color: var(--muted); text-align: center; padding-bottom: 4px;
    }
    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
    .cal-cell {
      display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
      min-height: 48px; padding: 5px 2px 4px; border-radius: 8px;
      text-decoration: none; color: inherit; line-height: 1.1;
    }
    .cal-empty { background: none; }
    .cal-num { font-size: 13px; font-weight: 600; }
    .cal-kcal { font-size: 10px; color: var(--muted); margin-top: 1px; }
    .cal-dots { display: flex; gap: 2px; margin-top: 2px; height: 5px; }
    .cal-dots .dot { width: 5px; height: 5px; border-radius: 50%; display: inline-block; }
    .cal-dots .dot.bad { background: var(--bad); }
    .cal-dots .dot.ev { background: #6366f1; }
    .cal-ok     { background: #dcfce7; color: #14532d; }
    .cal-warn   { background: #fef3c7; color: #713f12; }
    .cal-bad    { background: #fee2e2; color: #7f1d1d; }
    /* Kolor nie moze byc jedynym sygnalem, wiec stan ma tez znak. */
    .cal-warn .cal-num::after { content: '!'; font-size: 9px; vertical-align: super; opacity: .8; }
    .cal-bad  .cal-num::after { content: '×'; font-size: 11px; vertical-align: super; opacity: .9; }
    .cal-ok .cal-kcal, .cal-warn .cal-kcal, .cal-bad .cal-kcal { color: inherit; opacity: .75; }
    .cal-gap    { background: repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 4px, #e5e7eb 4px, #e5e7eb 8px); }
    .cal-none   { background: #f3f4f6; }
    .cal-future { background: transparent; border: 1px dashed rgba(0,0,0,.12); }
    .cal-today  { outline: 2px solid var(--f7-theme-color); outline-offset: -2px; }
    .dark-mode .cal-ok   { background: #14532d; color: #dcfce7; }
    .dark-mode .cal-warn { background: #713f12; color: #fef3c7; }
    .dark-mode .cal-bad  { background: #7f1d1d; color: #fee2e2; }
    .dark-mode .cal-none { background: #27272a; }
    .dark-mode .cal-gap  { background: repeating-linear-gradient(45deg, #27272a, #27272a 4px, #3f3f46 4px, #3f3f46 8px); }
    .dark-mode .cal-future { border-color: rgba(255,255,255,.15); }
    .cal-legend {
      display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;
      font-size: 11px; color: var(--muted);
    }
    .cal-legend .sw {
      display: inline-block; width: 10px; height: 10px; border-radius: 3px;
      vertical-align: -1px; margin-right: 3px;
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

// Pięć pozycji to górna granica czytelnej dolnej nawigacji na telefonie.
// Ustawienia i Wykluczenia mają swoje wejścia w pasku górnym, bo wchodzi
// się tam raz na jakiś czas, a nie kilka razy dziennie.
const TABS: Array<{ href: string; icon: string; label: string; key: string }> = [
  { href: '/', icon: '🍽️', label: 'Dziś', key: 'today' },
  { href: '/kalendarz', icon: '🗓️', label: 'Kalendarz', key: 'calendar' },
  { href: '/log', icon: '➕', label: 'Dopisz', key: 'log' },
  { href: '/suplementy', icon: '💊', label: 'Suple', key: 'supplements' },
  { href: '/week', icon: '📊', label: 'Tydzień', key: 'week' },
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
