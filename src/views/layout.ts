import { ASSET_V } from './assets';

/**
 * Jedna lista, trzy zastosowania.
 *
 * `tab` to pasek na telefonie. Kolejnosc jest kolejnoscia czytania dnia:
 * najpierw stan („Dziś"), potem dwa spojrzenia wstecz (kalendarz i statystyki),
 * dopiero potem dwie akcje (dopisz, suple). Reszta siedzi za pozycja „Więcej".
 *
 * Liczba pozycji w pasku nie jest wpisana w arkusz. `grid-auto-flow: column`
 * bierze ja z tej listy, wiec dodanie albo usuniecie zakladki nie wymaga
 * ruszania CSS i nie da sie doprowadzic do rozjazdu miedzy jednym a drugim.
 * Przy szesciu pozycjach na 402 px kolumna ma 67 px, czyli powyzej progu 44 px.
 *
 * `hub` oznacza sama pozycje „Więcej". Na duzym ekranie menu boczne pokazuje
 * wszystko naraz, wiec hub jest tam zbedny i jest z niego wylaczony.
 */
const NAV: Array<{
  href: string; icon: string; label: string; key: string;
  tab: boolean; hub?: boolean; opis?: string;
}> = [
  { href: '/', icon: '🍽️', label: 'Dziś', key: 'today', tab: true },
  { href: '/kalendarz', icon: '🗓️', label: 'Kalendarz', key: 'calendar', tab: true,
    opis: 'Miesiąc dzień po dniu, przerwy w dostawach cateringu' },
  { href: '/statystyki', icon: '📊', label: 'Statystyki', key: 'stats', tab: true,
    opis: 'Dowolny zakres dat: makro, przerwy między podejściami, objawy' },
  { href: '/log', icon: '➕', label: 'Dopisz', key: 'log', tab: true },
  { href: '/suplementy', icon: '💊', label: 'Suple', key: 'supplements', tab: true },
  { href: '/wiecej', icon: '☰', label: 'Więcej', key: 'more', tab: true, hub: true },
  { href: '/zakupy', icon: '🛒', label: 'Zakupy', key: 'shopping', tab: false,
    opis: 'Lista do kupienia i podpowiedzi z brakujących grup' },
  { href: '/restrictions', icon: '🚫', label: 'Wykluczenia', key: 'restrictions', tab: false,
    opis: 'Zakazy, limity i kolejka nierozpoznanych składników' },
  { href: '/ustawienia', icon: '⚙️', label: 'Ustawienia', key: 'settings', tab: false,
    opis: 'Okna jedzenia, zasady przerw, catering, szablony, suplementy' },
];

/** Pozycje spoza paska, czyli zawartosc ekranu „Więcej" i dolnej czesci menu bocznego. */
export const NAV_POZA_PASKIEM = NAV.filter((n) => !n.tab);

/**
 * Jedna aplikacja, dwa układy.
 *
 * Do 1024 px treść idzie w kolumnie, a nawigacja siedzi na dole, jak było.
 * Powyżej pojawia się boczne menu ze wszystkimi pozycjami, dolny pasek znika,
 * treść dostaje szerokość i siatki wielokolumnowe. Ten sam HTML, decyduje CSS.
 *
 * Framework7 został usunięty. To biblioteka do udawania natywnej aplikacji na
 * telefonie i to ona wymuszała jedną kolumnę oraz marginesy liczone pod 375 px.
 * Klasy w widokach zostały te same, zmienił się tylko ich właściciel.
 */
export function layout(title: string, content: string, activeTab?: string) {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <!-- Bez maximum-scale i user-scalable=no: blokowanie powiekszania to bariera
       dostepnosci, a na duzym ekranie nie ma czego chronic przed zoomem. -->
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#16a34a">
  <meta name="color-scheme" content="light dark">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Food">
  <title>${title} - Food</title>

  <link rel="manifest" href="/manifest.json">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/icons/icon-192.svg">
  <link rel="stylesheet" href="/css/food-theme.css?v=${ASSET_V}">
  <script src="/js/htmx.min.js"></script>
</head>
<body>
  <script>
    var savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' ||
        (savedTheme === null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark-mode');
    }
  </script>

  ${content}

  ${activeTab === undefined ? '' : tabbar(activeTab)}
  <div id="page-loader"></div>

  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(function (reg) { if (reg) reg.update().catch(function () {}); });
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(function () {});
    }

    window.toggleTheme = function () {
      var isDark = document.documentElement.classList.toggle('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      document.querySelectorAll('.theme-toggle').forEach(function (b) { b.textContent = isDark ? '☀️' : '🌙'; });
    };

    document.addEventListener('DOMContentLoaded', function () {
      var isDark = document.documentElement.classList.contains('dark-mode');
      document.querySelectorAll('.theme-toggle').forEach(function (b) { b.textContent = isDark ? '☀️' : '🌙'; });

      document.addEventListener('click', function (e) {
        var link = e.target.closest ? e.target.closest('a[href]') : null;
        if (link && link.href && link.href.indexOf(location.origin) === 0) {
          var loader = document.getElementById('page-loader');
          if (loader) loader.classList.add('active');
        }
      });
    });

    window.addEventListener('pageshow', function () {
      var loader = document.getElementById('page-loader');
      if (loader) loader.classList.remove('active');
    });
  </script>
</body>
</html>`;
}

/** Boczne menu, widoczne dopiero od 1024 px. */
export function sidenav(active?: string): string {
  const item = (n: (typeof NAV)[number]) =>
    `<a href="${n.href}" class="${n.key === active ? 'active' : ''}"${n.key === active ? ' aria-current="page"' : ''}>
      <span class="tab-icon" aria-hidden="true">${n.icon}</span><span>${n.label}</span>
    </a>`;

  return `<aside class="sidenav">
    <div class="sidenav-brand"><span aria-hidden="true">🍽️</span><span>Food</span></div>
    ${NAV.filter((n) => n.tab && !n.hub).map(item).join('')}
    <div class="sidenav-sep"></div>
    ${NAV_POZA_PASKIEM.map(item).join('')}
  </aside>`;
}

function tabbar(active: string) {
  return `<nav class="tabbar-bottom" aria-label="Nawigacja główna">
    ${NAV.filter((n) => n.tab)
      .map(
        (t) => `<a href="${t.href}" class="${t.key === active ? 'active' : ''}"${t.key === active ? ' aria-current="page"' : ''}>
      <span class="tab-icon" aria-hidden="true">${t.icon}</span>
      <span>${t.label}</span>
    </a>`
      )
      .join('')}
  </nav>`;
}
