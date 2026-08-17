import { Cel, stanMakro } from './day-status';
import { Gotowosc, POTRZEBA_SNU_MIN } from './trening';

/**
 * Wnioski i rekomendacje na gorze ekranu statystyk.
 *
 * Regula gry: kazdy wniosek stoi na liczbach z wybranego zakresu i wypisuje
 * je w opisie, zeby dalo sie go sprawdzic bez otwierania bazy. Zadnego
 * straszenia: jedno odchylenie to obserwacja, nie diagnoza, a ton ma byc taki,
 * jakim mowi sie do doroslego czlowieka, ktory sam zbiera te dane.
 *
 * Trzy poziomy i kazdy znaczy co innego:
 *   `zrob`   jest konkretna rzecz do zrobienia, z liczba, ktora ja uzasadnia
 *   `uwaga`  cos warto obserwowac albo dopisac, ale nic sie nie pali
 *   `ok`     obszar dziala; jest na liscie, zeby bylo widac, ze zostal policzony
 *
 * Progi z tego pliku nie zyja nigdzie indziej. Pasma makro przychodza z fazy
 * (`targets`), potrzeba snu z trening.ts, norma Bristol 3 do 4 z tej samej
 * decyzji, ktora koloruje wykres stolca.
 */

export interface Wniosek {
  poziom: 'zrob' | 'uwaga' | 'ok';
  obszar: string;
  tytul: string;
  opis: string;
}

export interface DaneWnioskow {
  dniZakresu: number;
  dniZWpisami: number;
  /** Srednie dzienne makro z dni z wpisami. */
  srednie: { kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number };
  cel: (metric: string) => Cel | undefined;
  przerwy: { dni: number; dniPonizejProgu: number } | null;
  minGapH: number;
  /** Zjedzone produkty zakazane, po nazwie, z liczba wystapien. */
  zakazane: Array<{ nazwa: string; n: number }>;
  /** Grupy ponizej reguly tygodniowej. */
  grupyPonizej: Array<{ nazwa: string; naTydzien: number; celDni: number; krytyczna: boolean }>;
  /** Wszystkie wpisy Bristol z zakresu. */
  bristole: number[];
  stres: { dni: number; srednia: number; napiete: number } | null;
  /** Stolce z 1 i 2 dob po dniach napietych i po spokojnych. */
  stresStolec: { poNapietych: number[]; poSpokojnych: number[] } | null;
  /** Sen w minutach z ostatnich 14 dob z pomiarem. */
  sen14: number[];
  /** Mediana krokow z dob zakresu, ktore maja pomiar. */
  krokiMediana: number | null;
  gotowosc: Gotowosc | null;
}

const pl = (v: number, d = 0) => v.toFixed(d).replace('.', ',');
const godz = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`;

const sr = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

export function ulozWnioski(d: DaneWnioskow): Wniosek[] {
  const zrob: Wniosek[] = [];
  const uwaga: Wniosek[] = [];
  const ok: Wniosek[] = [];

  /* ── Sen ─────────────────────────────────────────────────────────── */
  if (d.sen14.length >= 5) {
    const senSr = sr(d.sen14);
    const brakuje = POTRZEBA_SNU_MIN - senSr;
    if (brakuje >= 20) {
      zrob.push({
        poziom: 'zrob', obszar: 'Sen',
        tytul: `Kładź się o ${pl(Math.ceil(brakuje / 15) * 15)} minut wcześniej`,
        opis: `Ostatnie ${d.sen14.length} nocy to średnio ${godz(senSr)} snu, a Twoja potrzeba liczona z własnej historii to około ${godz(POTRZEBA_SNU_MIN)}. ` +
          `Najprościej domknąć to stałą porą gaszenia światła, nie odsypianiem w weekend.`,
      });
    } else {
      ok.push({
        poziom: 'ok', obszar: 'Sen',
        tytul: `Sen w porządku: średnio ${godz(senSr)}`,
        opis: `Z ${d.sen14.length} ostatnich nocy z pomiarem. Potrzeba to około ${godz(POTRZEBA_SNU_MIN)}.`,
      });
    }
  }

  /* ── Regeneracja ─────────────────────────────────────────────────── */
  if (d.gotowosc && d.gotowosc.stan !== 'zielona') {
    uwaga.push({
      poziom: 'uwaga', obszar: 'Regeneracja',
      tytul: d.gotowosc.stan === 'czerwona' ? 'Dziś odpuść intensywny wysiłek' : 'Dziś objętość tak, intensywność nie',
      opis: `${d.gotowosc.powody.join(', ')}. Szczegóły i plan na kolejne dni są w sekcji treningowej niżej.`,
    });
  }

  /* ── Stres ───────────────────────────────────────────────────────── */
  if (d.stres && d.stres.dni >= 5) {
    const czesteNapiecie = d.stres.napiete >= Math.max(2, d.stres.dni / 3) || d.stres.srednia >= 5;

    // Zdanie o jelicie tylko wtedy, gdy po obu stronach jest z czego liczyc.
    // Roznica ponizej 0,7 stopnia Bristol to szum, nie zaleznosc.
    let jelito = '';
    if (d.stresStolec && d.stresStolec.poNapietych.length >= 5 && d.stresStolec.poSpokojnych.length >= 5) {
      const roznica = sr(d.stresStolec.poNapietych) - sr(d.stresStolec.poSpokojnych);
      if (Math.abs(roznica) >= 0.7) {
        jelito = ` W Twoich danych po dniach napiętych stolec jest ${roznica < 0 ? 'twardszy' : 'luźniejszy'} ` +
          `(średnio ${pl(sr(d.stresStolec.poNapietych), 1)} wobec ${pl(sr(d.stresStolec.poSpokojnych), 1)} w skali Bristol), ` +
          `więc to nie jest teoria, tylko Twój wzorzec.`;
      }
    }

    if (czesteNapiecie) {
      zrob.push({
        poziom: 'zrob', obszar: 'Stres',
        tytul: 'Wstaw w dzień stały moment wyciszenia',
        opis: `${d.stres.napiete} z ${d.stres.dni} wpisanych dni miało napięcie 6 lub więcej, średnia to ${pl(d.stres.srednia, 1)}/10. ` +
          `10 minut oddechu, medytacji albo spaceru bez telefonu, codziennie o tej samej porze, działa lepiej niż długi odpoczynek raz w tygodniu.${jelito}`,
      });
    } else {
      ok.push({
        poziom: 'ok', obszar: 'Stres',
        tytul: `Napięcie pod kontrolą: średnio ${pl(d.stres.srednia, 1)}/10`,
        opis: `${d.stres.napiete} z ${d.stres.dni} wpisanych dni z oceną 6 lub więcej.${jelito}`,
      });
    }
  } else if (d.stres && d.stres.dni > 0) {
    uwaga.push({
      poziom: 'uwaga', obszar: 'Stres',
      tytul: 'Wpisuj stres wieczorem, żeby było z czego liczyć',
      opis: `W zakresie jest ${d.stres.dni} ${d.stres.dni === 1 ? 'wpis' : 'wpisy'} o stresie. ` +
        `Porównanie dni napiętych ze spokojnymi rusza od kilku dni po każdej stronie.`,
    });
  }

  /* ── Ruch ────────────────────────────────────────────────────────── */
  if (d.krokiMediana !== null) {
    const bristolSr = d.bristole.length >= 5 ? sr(d.bristole) : null;
    if (d.krokiMediana < 7000) {
      zrob.push({
        poziom: 'zrob', obszar: 'Ruch',
        tytul: 'Dołóż codzienny spacer 20 do 30 minut',
        opis: `Mediana z ostatnich 30 dni to ${pl(d.krokiMediana)} kroków dziennie. Spacer pół godziny dokłada około 3000. ` +
          `Ruch niezależnie od wszystkiego przyspiesza pracę jelita` +
          (bristolSr !== null && bristolSr < 3 ? `, a Twoje stolce z tego zakresu przechylają się w stronę zaparcia (średnio ${pl(bristolSr, 1)} w skali Bristol)` : '') + `.`,
      });
    } else {
      ok.push({
        poziom: 'ok', obszar: 'Ruch',
        tytul: `Ruchu wystarcza: mediana ${pl(d.krokiMediana)} kroków dziennie`,
        opis: 'Struktura treningów jest w sekcji treningowej niżej.',
      });
    }
  }

  /* ── Rytm posiłków ───────────────────────────────────────────────── */
  if (d.przerwy && d.przerwy.dni >= 3) {
    if (d.przerwy.dniPonizejProgu > d.przerwy.dni / 4) {
      zrob.push({
        poziom: 'zrob', obszar: 'Rytm posiłków',
        tytul: `Pilnuj przerw co najmniej ${pl(d.minGapH)} h`,
        opis: `${d.przerwy.dniPonizejProgu} z ${d.przerwy.dni} dni miało przerwę krótszą niż ${pl(d.minGapH)} h. ` +
          `Fala oczyszczająca jelito rusza dopiero po opróżnieniu żołądka, więc dojadanie między podejściami ją gasi. ` +
          `Najczęstszy winowajca to kawa z mlekiem albo przekąska po posiłku: dopisz je do najbliższego podejścia zamiast osobno.`,
      });
    } else {
      ok.push({
        poziom: 'ok', obszar: 'Rytm posiłków',
        tytul: 'Przerwy między podejściami trzymają się progu',
        opis: `${d.przerwy.dniPonizejProgu} z ${d.przerwy.dni} dni poniżej ${pl(d.minGapH)} h.`,
      });
    }
  }

  /* ── Makro ───────────────────────────────────────────────────────── */
  // Tluszcz i blonnik przed reszta, bo to one koloruja kalendarz i za oboma
  // stoi powod kliniczny: elastaza przy tluszczu, twardosc stolca przy blonniku.
  const MAKRA: Array<{ key: keyof DaneWnioskow['srednie']; nazwa: string; unit: string; kliniczne: boolean }> = [
    { key: 'fat_g', nazwa: 'Tłuszcz', unit: 'g', kliniczne: true },
    { key: 'fiber_g', nazwa: 'Błonnik', unit: 'g', kliniczne: true },
    { key: 'kcal', nazwa: 'Kalorie', unit: 'kcal', kliniczne: false },
    { key: 'protein_g', nazwa: 'Białko', unit: 'g', kliniczne: false },
  ];

  if (d.dniZWpisami >= 3) {
    const poza: string[] = [];
    for (const m of MAKRA) {
      const cel = d.cel(m.key);
      if (!cel) continue;
      const v = d.srednie[m.key];
      if (stanMakro(v, cel) === 'ok') continue;
      const pasmo = cel.min_value !== null && cel.max_value !== null
        ? `${pl(cel.min_value)} do ${pl(cel.max_value)}`
        : cel.min_value !== null ? `min. ${pl(cel.min_value)}` : `maks. ${pl(cel.max_value ?? 0)}`;
      const kierunek = cel.min_value !== null && v < cel.min_value ? 'poniżej' : 'powyżej';
      const zdanie = `${m.nazwa} średnio ${pl(v)} ${m.unit} przy paśmie ${pasmo} ${m.unit}, czyli ${kierunek}`;
      if (m.kliniczne) {
        zrob.push({
          poziom: 'zrob', obszar: 'Dieta',
          tytul: `${m.nazwa}: wróć do pasma fazy`,
          opis: `${zdanie}. ` + (m.key === 'fiber_g' && kierunek === 'powyżej'
            ? 'U Ciebie więcej błonnika to twardszy stolec, dlatego góra pasma jest tu granicą, nie sugestią.'
            : 'To jedno z dwóch makr, które u Ciebie mają powód kliniczny, więc pilnujemy go w pierwszej kolejności.'),
        });
      } else {
        poza.push(zdanie);
      }
    }
    if (poza.length) {
      uwaga.push({
        poziom: 'uwaga', obszar: 'Dieta',
        tytul: 'Kalorie albo białko odjeżdżają od pasma',
        opis: poza.join('. ') + '. Te makra nie mają u Ciebie powodu klinicznego, więc to obserwacja, nie alarm.',
      });
    }
    if (!zrob.some((w) => w.obszar === 'Dieta') && !poza.length) {
      ok.push({
        poziom: 'ok', obszar: 'Dieta',
        tytul: 'Makra siedzą w pasmach fazy',
        opis: `Średnie z ${d.dniZWpisami} dni z wpisami mieszczą się w celach.`,
      });
    }
  }

  /* ── Wykluczenia ─────────────────────────────────────────────────── */
  if (d.zakazane.length) {
    const lista = d.zakazane.slice(0, 3).map((z) => `${z.nazwa} (${z.n}x)`).join(', ');
    zrob.push({
      poziom: 'zrob', obszar: 'Dieta',
      tytul: 'Wytnij produkty z listy zakazanych',
      opis: `W zakresie zjedzone: ${lista}${d.zakazane.length > 3 ? ' i dalej' : ''}. ` +
        `Pełna lista z posiłkami jest w sekcji naruszeń niżej. Zakazy w tej fazie są po to, żeby dało się cokolwiek wnioskować z objawów.`,
    });
  }

  /* ── Pokrycie grup ───────────────────────────────────────────────── */
  if (d.grupyPonizej.length) {
    const lista = d.grupyPonizej.slice(0, 3)
      .map((g) => `${g.nazwa} ${pl(g.naTydzien, 1)} z ${g.celDni} dni/tydz.`).join(', ');
    zrob.push({
      poziom: 'zrob', obszar: 'Dieta',
      tytul: `Dołóż brakujące grupy produktów`,
      opis: `Poniżej reguły tygodniowej: ${lista}${d.grupyPonizej.length > 3 ? ' i dalej' : ''}. ` +
        `Podpowiedzi, w które dni je wstawić, są na widoku dnia i na liście zakupów.`,
    });
  }

  /* ── Stolec ──────────────────────────────────────────────────────── */
  if (d.bristole.length >= 5) {
    const b = sr(d.bristole);
    const twarde = d.bristole.filter((x) => x <= 2).length;
    const luzne = d.bristole.filter((x) => x >= 6).length;
    if (b < 2.75) {
      zrob.push({
        poziom: 'zrob', obszar: 'Stolec',
        tytul: 'Przeważa zaparcie: woda i ruch przed zmianami w diecie',
        opis: `Średnia z ${d.bristole.length} wpisów to ${pl(b, 1)} w skali Bristol, ${twarde} z nich to stolce twarde (typ 1 lub 2), a pasmo prawidłowe to 3 do 4. ` +
          `Zacznij od najtańszych dźwigni: 2 litry wody dziennie i codzienny spacer. Błonnika nie podnoś ponad pasmo, bo u Ciebie działa w drugą stronę.`,
      });
    } else if (b > 5) {
      zrob.push({
        poziom: 'zrob', obszar: 'Stolec',
        tytul: 'Przeważa stolec luźny: przejrzyj ostatnie dni w kalendarzu',
        opis: `Średnia z ${d.bristole.length} wpisów to ${pl(b, 1)} w skali Bristol, ${luzne} z nich to stolce luźne (typ 6 lub 7). ` +
          `Zestaw dni z luźnym stolcem z posiłkami dzień wcześniej: kalendarz kropkuje dni z wpisami, więc łatwo je znaleźć.`,
      });
    } else {
      ok.push({
        poziom: 'ok', obszar: 'Stolec',
        tytul: `Stolec blisko normy: średnio ${pl(b, 1)} w skali Bristol`,
        opis: `Z ${d.bristole.length} wpisów ${twarde} to stolce twarde, a ${luzne} luźne. Pasmo prawidłowe to 3 do 4.`,
      });
    }
  }

  /* ── Kompletnosc danych ──────────────────────────────────────────── */
  if (d.dniZWpisami < d.dniZakresu * 0.7) {
    uwaga.push({
      poziom: 'uwaga', obszar: 'Dane',
      tytul: 'Sporo dni bez wpisów',
      opis: `${d.dniZWpisami} z ${d.dniZakresu} dni ma wpisane jedzenie. Wszystkie wnioski wyżej stoją na dniach z wpisami, ` +
        `więc im więcej dziur, tym łatwiej o wniosek z przypadku.`,
    });
  }

  return [...zrob, ...uwaga, ...ok];
}
