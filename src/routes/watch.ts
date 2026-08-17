import { Hono } from 'hono';
import { Env } from '../types';
import {
  card, blockTitle, emptyState, esc, todayWarsaw, shiftDate, daysBetween,
} from '../views/ui';
import { loadSettings } from '../utils/settings';
import {
  METRYKI, Metryka, WatchRow, Norma, Bilans, normy, sygnaly, stan, MIN_DNI_NORMY,
  bilans, zdanieBilansu, zdanieMasy, kgNaTydzien, KCAL_NA_KILOGRAM,
} from '../utils/watch';
import { slupkowy, zwinDoTygodni, etykietaDnia } from '../views/charts';
import { policzBaterie } from '../utils/bateria';
import { podsumujTydzien, TreningWpis, PROG_INTENSYWNY_KCAL_MIN } from '../utils/trening';

/**
 * Ekran zegarka.
 *
 * Odpowiada na trzy pytania i w tej kolejnosci: czy wczoraj cos odstawalo,
 * jak to wyglada na tle ostatnich tygodni, i co w ogole mierzymy. Trzecie jest
 * na dole celowo, bo czyta sie je raz, a dwa pierwsze przy kazdym wejsciu.
 *
 * Dane wchodza wsadem: `npm run watch:import`. Ten ekran niczego nie zapisuje.
 */
const watch = new Hono<{ Bindings: Env }>();

/*
 * Norma liczy sie ZAWSZE z tego samego okna, niezaleznie od wybranego zakresu.
 * Inaczej przelaczenie na „14 dni" zwezaloby norme do dwoch tygodni i dzien
 * typowy potrafilby nagle wyladowac poza nia, bo zmienil sie punkt odniesienia,
 * a nie stan organizmu.
 */
const OKNO_NORMY = 180;

/**
 * Trend jednej metryki zegarka w czasie.
 *
 * Powyzej trzech miesiecy dni zwijaja sie w tygodnie (mediana, jak wszedzie
 * przy zegarku), bo 365 slupkow na szerokosci telefonu ma po jednym pikselu
 * i nie pokazuje juz trendu, tylko szum. Rysowanie siedzi w views/charts.ts,
 * tu zostaje tylko to, co zegarkowe: ktora strona normy jest zla.
 */
function wykresMetryki(dni: WatchRow[], m: Metryka, n: Norma | undefined, zwin: boolean): string {
  const seria = dni
    .filter((d) => typeof d[m.key] === 'number')
    .map((d) => ({ date: d.date, v: d[m.key] as number }));
  const punkty = zwin
    ? zwinDoTygodni(seria, 'mediana')
    : seria.map((x) => ({ etykieta: etykietaDnia(x.date), v: x.v }));

  if (punkty.length < 2) return emptyState('Za mało dni, żeby narysować trend.');

  // Bursztyn lapie tylko zly ogon: przy HRV i snie dol, przy tetnie gore.
  const pasmo = n ? (m.kierunek === 'wyzej' ? { min: n.p10 } : { max: n.p90 }) : null;

  // Zdanie o skali od najnizszego punktu jest JEDNO, we wspolnej notce
  // "Jak to liczymy" na dole statystyk, nie pod kazdym wykresem osobno.
  return card(`
    ${slupkowy(punkty, { pasmo, linia: n?.mediana ?? null, format: m.format })}
    <p class="hint" style="margin:8px 0 0">
      ${esc(m.label)}${zwin ? ', mediana tygodnia' : ' dzień po dniu'}.
      ${n ? 'Kreska to Twoja mediana, bursztynowe słupki to dni poza Twoim pasmem typowym.' : ''}
    </p>`);
}

/**
 * Sekcje zegarka do wstawienia w ekran statystyk.
 *
 * Do 15.08.2026 byl to osobny ekran pod `/zegarek`, z wlasnym przelacznikiem
 * zakresu i wlasna sekcja „Ile tego jest". Dwa ekrany odpowiadaly na to samo
 * pytanie w dwoch miejscach, a nazwa „Zegarek" przestala byc prawdziwa, gdy
 * do tabeli zaczely pisac trzy zrodla. Zostaje jeden ekran i jeden zakres.
 */
export async function sekcjeZegarka(
  db: D1Database,
  o: { od: string; do: string },
  dniZakresu: number
): Promise<string> {
  const dzis = todayWarsaw();

  const [wZakresie, doNormy, ostatni, zjedzone, ostatniaWaga, oceny, stresy, treningiOkno] = await Promise.all([
    db.prepare(`SELECT * FROM watch WHERE date BETWEEN ? AND ? ORDER BY date`)
      .bind(o.od, o.do).all<WatchRow>(),
    db.prepare(`SELECT * FROM watch WHERE date BETWEEN ? AND ? ORDER BY date`)
      .bind(shiftDate(dzis, -OKNO_NORMY), dzis).all<WatchRow>(),
    db.prepare(`SELECT * FROM watch ORDER BY date DESC LIMIT 1`).first<WatchRow>(),
    db.prepare(`SELECT date, kcal, meals_estimated FROM v_day_totals WHERE date BETWEEN ? AND ?`)
      .bind(o.od, o.do).all<any>(),
    db.prepare(`SELECT date, waga FROM watch WHERE waga IS NOT NULL ORDER BY date DESC LIMIT 1`)
      .first<any>(),
    // Do konfrontacji baterii z ocena: oceny z zakresu, stres i treningi
    // cofniete o tyle, ile potrzebuje rachunek wczorajszych obciazen.
    db.prepare(`SELECT date, level FROM energy WHERE date BETWEEN ? AND ?`)
      .bind(o.od, o.do).all<any>(),
    db.prepare(`SELECT date, level FROM stress WHERE date BETWEEN ? AND ?`)
      .bind(shiftDate(o.od, -1), o.do).all<any>(),
    db.prepare(`SELECT date, typ_apple, minuty, kcal FROM workouts WHERE date BETWEEN ? AND ? ORDER BY date`)
      .bind(shiftDate(o.od, -10), o.do).all<any>(),
  ]);

  const lista = wZakresie.results ?? [];
  const n = normy(doNormy.results ?? []);
  const bmrWlasny = Number((await loadSettings(db)).get('bmr_kcal') || 0) || null;

  if (!ostatni) {
    return `${blockTitle('Zegarek')}${emptyState(
      'Żadnych danych z zegarka. Dosyła je aplikacja Health Sync na telefonie, przyciskiem Synchronizuj.'
    )}`;
  }

  const brakDni = daysBetween(ostatni.date, dzis);
  const stanDanych = card(`
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
      <span style="font-size:13px;color:var(--muted)">Ostatnia doba z zegarka</span>
      <b style="font-size:19px">${esc(ostatni.date)}</b>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:8px">
      <span style="font-size:13px;color:var(--muted)">Dni z danymi w zakresie</span>
      <b style="font-size:19px">${lista.length} <span style="font-size:13px;font-weight:400;color:var(--muted)">z ${dniZakresu}</span></b>
    </div>
    ${brakDni > 2
      ? `<p class="hint" style="margin:8px 0 0;color:var(--warn)">
          Dane kończą się ${brakDni} dni temu. Otwórz Health Sync na telefonie i kliknij Synchronizuj.
        </p>`
      : ''}
    ${n.size === 0
      ? `<p class="hint" style="margin:8px 0 0">
          Norma jeszcze nie powstała. Potrzeba minimum ${MIN_DNI_NORMY} dni pomiarów, żeby liczby miały do czego się odnosić.
        </p>`
      : ''}`);

  /*
   * Sygnaly liczone dla ostatniej doby, nie dla dnia dzisiejszego. Dzisiejszy
   * wiersz w bazie zwykle nie istnieje, bo eksport robi sie raz na kilka
   * tygodni, a pusta sekcja „wszystko w normie" klamalaby, sugerujac pomiar.
   */
  const sygnalyOstatniej = sygnaly(ostatni, n);
  const uwaga = sygnalyOstatniej.length
    ? card(sygnalyOstatniej.map((s) => `
        <div class="ostrzezenie">
          <span class="flag limit">!</span>
          <span>
            <b>${esc(s.metryka.label)}: ${esc(s.metryka.format(s.wartosc))}</b>,
            Twoja norma to ${esc(s.metryka.format(s.norma.mediana))}
            <br><span class="ostrzezenie-opis">${esc(s.metryka.sygnal ?? '')}</span>
          </span>
        </div>`).join('') + `
        <p class="hint" style="margin:10px 0 0">
          Dotyczy doby ${esc(ostatni.date)}. Jeden dzień poza normą to najczęściej krótka noc albo kieliszek wina.
          Dopiero trzy pod rząd znaczą, że dzieje się coś, co warto powiązać z objawami.
        </p>`)
    : card(`<p style="margin:0;font-size:14px">
        Nic nie odstaje. Doba ${esc(ostatni.date)} mieści się w Twojej normie we wszystkim, co zegarek mierzy.
      </p>`);

  /*
   * Bilans kalorii.
   *
   * Dzien dzisiejszy jest z niego WYKLUCZONY i to nie jest ostroznosc, tylko
   * warunek sensu. Przemiana podstawowa narasta przez cala dobe, wiec o
   * poludniu wynosi polowe tego, co wyniesie wieczorem, a bilans pokazywalby
   * potezna nadwyzke przy kazdym sniadaniu.
   *
   * Dni bez wpisanego jedzenia tez wypadaja. Zero kcal z bazy nie znaczy „nic
   * nie jadl", tylko „nie wpisal", a policzenie im deficytu 3000 kcal
   * zafalszowaloby srednia w strone, ktora najlatwiej wziac za sukces.
   */
  const zjedzoneWgDat = new Map<string, { kcal: number; szacowane: number }>(
    (zjedzone.results ?? []).map((t: any) => [t.date, { kcal: Number(t.kcal), szacowane: Number(t.meals_estimated ?? 0) }])
  );

  const dniBilansu = lista
    .map((d) => ({ d, b: bilans(zjedzoneWgDat.get(d.date)?.kcal, d, d.date < dzis, bmrWlasny) }))
    .filter((x): x is { d: WatchRow; b: Bilans } => x.b !== null);

  const sredniSaldo = dniBilansu.length
    ? dniBilansu.reduce((a, x) => a + x.b.saldo, 0) / dniBilansu.length
    : 0;
  const kg = kgNaTydzien(sredniSaldo);
  const naSzacunkach = dniBilansu.some((x) => (zjedzoneWgDat.get(x.d.date)?.szacowane ?? 0) > 0);

  const wiekWagi = ostatniaWaga ? daysBetween(ostatniaWaga.date, dzis) : null;

  const bilansHtml = dniBilansu.length
    ? card(`
      <div style="font-size:19px;font-weight:700;line-height:1.35">${esc(zdanieBilansu(sredniSaldo))}</div>
      <div style="font-size:15px;margin-top:4px">${esc(zdanieMasy(kg))}</div>
      <div style="font-size:13px;color:var(--muted);margin-top:6px">
        Średnia z ${dniBilansu.length} ${dniBilansu.length === 1 ? 'pełnego dnia' : 'pełnych dni'}.
        Dzisiejszy dzień nie wchodzi, bo się jeszcze nie skończył.
      </div>

      <div style="overflow-x:auto;margin-top:14px"><table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>Dzień</th><th style="text-align:right">zjadłeś</th><th style="text-align:right">spaliłeś</th><th style="text-align:right">różnica</th></tr></thead>
        <tbody>${[...dniBilansu].reverse().slice(0, 30).map(({ d, b }) => `<tr>
          <td><a href="/day/${d.date}">${d.date.slice(8)}.${d.date.slice(5, 7)}</a></td>
          <td style="text-align:right">${Math.round(b.zjedzone)}</td>
          <td style="text-align:right">${Math.round(b.spalone)}
            <span style="color:var(--muted);font-size:11px">${Math.round(b.bazowe)}+${Math.round(b.aktywne)}</span></td>
          <td style="text-align:right;white-space:nowrap;color:${b.saldo < -50 ? 'var(--ok)' : b.saldo > 50 ? 'var(--warn)' : 'var(--muted)'};font-weight:600">
            ${b.saldo < 0 ? '−' : '+'}${Math.abs(Math.round(b.saldo))}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <p class="hint" style="margin:6px 0 0">
        Minus w ostatniej kolumnie znaczy, że tego dnia zjadłeś mniej, niż spaliłeś. Plus, że więcej.
        Liczby przy „spaliłeś" to spoczynek plus ruch.
      </p>

      ${(() => {
        /*
         * Rachunek rozpisany na liczbach z OSTATNIEJ doby, nie na przykladzie.
         * Wzor z literami nie tlumaczy niczego, dopoki nie widac, ktora liczba
         * na tym ekranie jest ktora. Blok liczy sie sam, wiec nie da sie go
         * rozjechac z tabela wyzej.
         */
        const { d, b } = dniBilansu[dniBilansu.length - 1];
        const dzien = `${d.date.slice(8)}.${d.date.slice(5, 7)}`;
        const krok = (opis: string, rachunek: string) =>
          `<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:13px">
            <span style="color:var(--muted)">${opis}</span><b style="white-space:nowrap">${rachunek}</b>
          </div>`;
        return `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--hairline)">
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Jak to policzone, na przykładzie ${dzien}</div>
          ${krok('spalone w spoczynku, z ustawień', `${Math.round(b.bazowe)} kcal`)}
          ${krok('spalone ruchem, z zegarka', `+ ${Math.round(b.aktywne)} kcal`)}
          ${krok('razem spalone', `= ${Math.round(b.spalone)} kcal`)}
          ${krok('zjedzone, z dziennika', `− ${Math.round(b.zjedzone)} kcal`)}
          ${krok(b.saldo < 0 ? 'czyli zjadłeś mniej o' : 'czyli zjadłeś więcej o', `= ${Math.abs(Math.round(b.saldo))} kcal`)}
          <div style="height:8px"></div>
          ${krok(`to samo dla ${dniBilansu.length} ${dniBilansu.length === 1 ? 'dnia' : 'dni'} z tabeli, średnio`, `${Math.abs(Math.round(sredniSaldo))} kcal ${sredniSaldo < 0 ? 'mniej' : 'więcej'}`)}
          ${krok(`razy 7 dni, dzielone przez ${KCAL_NA_KILOGRAM} kcal na kilogram tłuszczu`, `${Math.abs(kg).toFixed(2).replace('.', ',')} kg tygodniowo ${kg < 0 ? 'w dół' : 'w górę'}`)}
        </div>`;
      })()}

      <p class="hint" style="margin:12px 0 0">
        <b>Ta liczba jest orientacyjna i trzeba o tym pamiętać za każdym razem.</b>
        ${dniBilansu[0].b.bazoweZZegarka
          ? `Przemiana podstawowa (pierwsza liczba w kolumnie „spalone") nie jest mierzona:
             Apple wylicza ją ze wzoru z wieku, wzrostu, masy i płci, nic nie wie o składzie ciała
             i zwykle wychodzi jej więcej niż z rachunku na masie beztłuszczowej.
             Własną liczbę ustawia się w Ustawieniach, pole „Własna przemiana podstawowa".`
          : `Przemiana podstawowa wzięta z ustawień (${Math.round(dniBilansu[0].b.bazowe)} kcal), nie z zegarka.`} Kalorie aktywne zegarek szacuje z tętna i ruchu, a przy sile potrafi
        pomylić się o kilkadziesiąt procent.${naSzacunkach ? ' Część posiłków po Twojej stronie też jest liczona na oko.' : ''}
        Każdy z tych błędów może iść w dowolną stronę.
      </p>
      <p class="hint" style="margin:8px 0 0">
        <b>Jedynym twardym sprawdzianem jest waga na łazienkowej wadze.</b>
        ${ostatniaWaga && wiekWagi !== null
          ? wiekWagi > 30
            ? `Ostatnia waga w Zdrowiu to ${String(ostatniaWaga.waga).replace('.', ',')} kg z ${esc(ostatniaWaga.date)}, czyli sprzed ${wiekWagi} dni.
               Przy takiej dziurze nie ma czym sprawdzić powyższych liczb. Podepnij wagę do Zdrowia albo waż się raz w tygodniu.`
            : `Ostatnia waga w Zdrowiu: ${String(ostatniaWaga.waga).replace('.', ',')} kg z ${esc(ostatniaWaga.date)}.
               Porównaj kierunek zmiany masy z saldem powyżej: jeśli idą w różne strony, to myli się bilans, nie waga.`
          : 'W Zdrowiu nie ma ani jednego pomiaru masy, więc powyższych liczb nie ma czym sprawdzić.'}
        Przelicznik ${KCAL_NA_KILOGRAM} kcal na kilogram pochodzi z energii czystego tłuszczu, a realny ubytek
        to zawsze mieszanka tłuszczu, wody i mięśni, więc pierwsze dni zawsze wyglądają szybciej, niż jest.
      </p>`)
    : emptyState(
        'Za mało dni, żeby liczyć bilans. Potrzebna jest doba, która ma i pomiar z zegarka, i wpisane jedzenie, ' +
        'i która już się skończyła. Dzisiejszy dzień nie wchodzi, bo przemiana podstawowa narasta do północy.'
      );

  // Kolumny tabeli to metryki sygnalowe plus sen glowny. Reszta siedzi w
  // normach nizej: w tabeli dzien po dniu osiem kolumn nie miesci sie na telefonie.
  const KOLUMNY = METRYKI.filter((m) => ['hrv_noc', 'rhr', 'sen_min', 'temperatura'].includes(m.key as string));

  const wiersze = [...lista].reverse().slice(0, 30).map((d) => {
    const komorki = KOLUMNY.map((m) => {
      const v = d[m.key];
      if (typeof v !== 'number') return `<td style="text-align:right;color:var(--muted)">–</td>`;
      const nm = n.get(m.key as string);
      const poza = stan(m, v, nm) === 'poza';
      return `<td style="text-align:right;white-space:nowrap;${poza ? 'color:var(--warn);font-weight:600' : ''}">
        ${esc(m.format(v))}
      </td>`;
    }).join('');
    return `<tr><td><a href="/day/${d.date}">${d.date.slice(8)}.${d.date.slice(5, 7)}</a></td>${komorki}</tr>`;
  }).join('');

  const tabela = lista.length
    ? `<div style="overflow-x:auto"><table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>Dzień</th>${KOLUMNY.map((m) => `<th style="text-align:right">${esc(m.label)}</th>`).join('')}</tr></thead>
        <tbody>${wiersze}</tbody>
      </table></div>
      ${lista.length > 30 ? `<p class="hint" style="margin:8px 0 0">Pokazane 30 ostatnich dni z ${lista.length} w zakresie. Trend z całego zakresu jest na wykresie wyżej.</p>` : ''}`
    : emptyState('Brak dni z zegarka w tym zakresie.');

  const normyHtml = n.size
    ? `<div style="overflow-x:auto"><table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>Metryka</th><th style="text-align:right">Twoja mediana</th><th style="text-align:right">pasmo typowe</th><th style="text-align:right">dni</th></tr></thead>
        <tbody>${METRYKI.map((m) => {
          const nm = n.get(m.key as string);
          if (!nm) return '';
          return `<tr>
            <td>${esc(m.label)}</td>
            <td style="text-align:right;white-space:nowrap"><b>${esc(m.format(nm.mediana))}</b></td>
            <td style="text-align:right;white-space:nowrap;color:var(--muted)">${esc(m.format(nm.p10))} do ${esc(m.format(nm.p90))}</td>
            <td style="text-align:right;color:var(--muted)">${nm.n}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <p class="hint" style="margin:10px 0 0">
        Liczone z ostatnich ${OKNO_NORMY} dni Twoich własnych pomiarów, nie z norm podręcznikowych.
        HRV zdrowych dorosłych rozciąga się od kilkunastu do ponad stu milisekund, więc jedyne, co ma sens,
        to porównanie Ciebie z Tobą. Pasmo typowe obejmuje osiem na dziesięć Twoich dni,
        czyli jeden dzień na pięć wypada poza nie i to jest normalne.
      </p>`
    : `<p class="hint" style="margin:0">
        Za mało dni. Norma powstaje przy ${MIN_DNI_NORMY} pomiarach, wcześniej progi byłyby szumem
        i co trzeci dzień wyglądałby na nietypowy.
      </p>`;

  /*
   * Bateria kontra Twoja ocena.
   *
   * Bateria nie jest nigdzie zapisana, liczy sie z tych samych danych co na
   * widoku dnia (jedna kopia rachunku w utils/bateria.ts), wiec zmiana wag
   * przelicza takze historie. Norma brana z okna biezacego, jak wszedzie na
   * tym ekranie. Sekcja szuka rozjazdow SYSTEMATYCZNYCH: pojedynczy dzien
   * niezgody to szum albo dzien nietypowy, ale stale zawyzanie w jedna strone
   * to argument, zeby przestawic wagi skladnikow.
   */
  const ocenaByDate = new Map<string, number>((oceny.results ?? []).map((x: any) => [x.date, Number(x.level)]));
  const stresByDate = new Map<string, number>((stresy.results ?? []).map((x: any) => [x.date, Number(x.level)]));
  const treningi = (treningiOkno.results ?? []) as TreningWpis[];

  const pary = lista.flatMap((d) => {
    const ocena = ocenaByDate.get(d.date);
    if (ocena === undefined) return [];
    const wczoraj = shiftDate(d.date, -1);
    const b = policzBaterie({
      doba: d,
      normy: n,
      stresWczoraj: stresByDate.get(wczoraj) ?? null,
      dniZRzedu: podsumujTydzien(treningi, wczoraj).dniZRzedu,
      intensywnaWczoraj: treningi.some(
        (t) => t.date === wczoraj && t.kcal !== null && t.minuty !== null
          && t.minuty >= 15 && t.kcal / t.minuty >= PROG_INTENSYWNY_KCAL_MIN
      ),
    });
    return b ? [{ date: d.date, procent: b.procent, ocena, roznica: b.procent - ocena * 10 }] : [];
  });

  const MIN_PAR = 5;
  const sredniaRoznica = pary.length
    ? pary.reduce((a, p) => a + p.roznica, 0) / pary.length
    : 0;
  const zdaniePrzesuniecia = Math.abs(sredniaRoznica) <= 10
    ? 'Bez systematycznego przesunięcia: algorytm i Twoje odczucie mówią mniej więcej to samo.'
    : sredniaRoznica > 0
      ? `Algorytm średnio ZAWYŻA o ${Math.round(Math.abs(sredniaRoznica))} pkt względem Twojego odczucia. Jeśli to się utrzyma, wagi składników są do przestawienia.`
      : `Algorytm średnio ZANIŻA o ${Math.round(Math.abs(sredniaRoznica))} pkt względem Twojego odczucia. Jeśli to się utrzyma, wagi składników są do przestawienia.`;

  const kolorRoznicy = (r: number) =>
    Math.abs(r) <= 15 ? 'var(--ok)' : 'var(--warn)';

  const bateriaOcenaHtml = pary.length
    ? card(`
      ${pary.length >= MIN_PAR
        ? `<div style="font-size:14px;margin-bottom:10px"><b>${esc(zdaniePrzesuniecia)}</b></div>`
        : `<p class="hint" style="margin:0 0 10px">
            ${pary.length} ${pary.length === 1 ? 'dzień' : 'dni'} z oceną i pomiarem. Wnioski o kalibracji ruszają od ${MIN_PAR}:
            wcześniej każda różnica to pojedynczy dzień, nie wzorzec.
          </p>`}
      <div style="overflow-x:auto"><table class="data-table" style="width:100%;font-size:13px">
        <thead><tr><th>Dzień</th><th style="text-align:right">algorytm</th><th style="text-align:right">Twoja ocena</th><th style="text-align:right">różnica</th></tr></thead>
        <tbody>${[...pary].reverse().slice(0, 14).map((p) => `<tr>
          <td><a href="/day/${p.date}">${p.date.slice(8)}.${p.date.slice(5, 7)}</a></td>
          <td style="text-align:right">${p.procent}%</td>
          <td style="text-align:right">${p.ocena}/10</td>
          <td style="text-align:right;font-weight:600;color:${kolorRoznicy(p.roznica)}">${p.roznica > 0 ? '+' : ''}${Math.round(p.roznica)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <p class="hint" style="margin:10px 0 0">
        Różnica to procent algorytmu minus Twoja ocena razy dziesięć: plus znaczy, że algorytm widział
        więcej sił niż Ty. Do 15 punktów uznajemy zgodę. Ocena wpisywana po zobaczeniu procentu jest nim
        trochę zakotwiczona, ale stałego przesunięcia w jedną stronę kotwica nie wyprodukuje i właśnie
        takiego przesunięcia tu szukamy.
      </p>`)
    : emptyState('Ani jednego dnia z oceną naładowania. Wpisuje się ją jednym dotknięciem przy baterii na widoku dnia.');

  const coSledzimy = `<div class="list media-list" style="margin:0"><ul>
    ${METRYKI.map((m) => `<li><div class="item-content"><div class="item-inner" style="display:block;padding:10px 0">
      <b style="font-size:14px">${esc(m.label)}</b>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">${esc(m.poCo)}</div>
      ${m.sygnal ? `<div style="font-size:12px;color:var(--warn);margin-top:4px">${esc(m.sygnal)}</div>` : ''}
    </div></div></li>`).join('')}
  </ul></div>`;

  return `
    ${blockTitle('Na co zwrócić uwagę', 'zegarek wobec Twojej normy')}
    ${uwaga}

    ${blockTitle('Bilans kalorii', 'zjedzone wobec spalonego')}
    ${bilansHtml}

    ${blockTitle('Bateria a Twoja ocena', 'algorytm kontra odczucie')}
    ${bateriaOcenaHtml}

    ${blockTitle('Trend HRV', `${esc(o.od)} do ${esc(o.do)}`)}
    ${wykresMetryki(lista, METRYKI.find((m) => m.key === 'hrv_noc')!, n.get('hrv_noc'), dniZakresu > 92)}

    ${blockTitle('Trend snu', `${esc(o.od)} do ${esc(o.do)}`)}
    ${wykresMetryki(lista, METRYKI.find((m) => m.key === 'sen_min')!, n.get('sen_min'), dniZakresu > 92)}

    ${blockTitle('Trend kroków', `${esc(o.od)} do ${esc(o.do)}`)}
    ${wykresMetryki(lista, METRYKI.find((m) => m.key === 'kroki')!, n.get('kroki'), dniZakresu > 92)}

    ${blockTitle('Zegarek dzień po dniu')}
    ${card(tabela)}

    <div id="norma"></div>
    ${blockTitle('Twoja norma', `ostatnie ${OKNO_NORMY} dni`)}
    ${card(normyHtml)}
    ${card(stanDanych)}

    ${blockTitle('Co śledzimy i po co')}
    ${coSledzimy}
  `;
}

/** Stary adres zostaje zywy, zeby nie psuc zakladek i linkow w rozmowach. */
watch.get('/zegarek', (c) => c.redirect('/statystyki?zakres=30#norma'));

export default watch;
