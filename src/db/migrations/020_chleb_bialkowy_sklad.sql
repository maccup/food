-- 2026-08-10, zdjecie tylnej etykiety chleba bialkowego (Lidl, "mit Olsaaten").
--
-- Sklad wreszcie odczytany: maka (...mehl), Sojaeiweisskonzentrat, 2,6% Sesam,
-- Weizenmehl, Weizenkleie, Apfelfaser. Czyli koncentrat bialka sojowego,
-- maka pszenna i otreby pszenne. Hipoteza z migracji 011 ("izolat sojowy
-- i gluten pszenny prawdopodobne") potwierdzona z etykiety, nie z makro.
--
-- Wartosci z etykiety zgadzaja sie co do dziesietnej z tym, co bylo wpisane:
-- 268 kcal, T 11,0 (nasycone 1,6), W 15,8 (cukry 1,5), blonnik 6,8, B 23,0,
-- sol 1,10 na 100 g. Porcja 35 g = 94 kcal, opakowanie ok. 14,3 porcji.
--
-- Restrykcja 45 mowila "do czasu odczytania skladu". Sklad odczytany, wiec
-- powod przestaje byc hipoteza. Poziom zostaje na limicie, nie idzie na zakaz,
-- bo od 14.08 wchodza pudelka i chleb i tak wypada z rotacji, a do tego czasu
-- to jedyne pieczywo w domu. Limit dostaje twarda liczbe zamiast warunku.

PRAGMA foreign_keys = ON;

UPDATE foods SET
  fodmap = 'high',
  fodmap_note = 'Maka pszenna i otreby pszenne, czyli fruktany. Do tego koncentrat bialka sojowego i wlokno jablkowe. Odczytane z etykiety 10.08.2026',
  fiber_type = 'insoluble',
  notes = '268 kcal / 100 g, T 11,0, W 15,8, blonnik 6,8, B 23,0, sol 1,10. Porcja producenta 35 g = 94 kcal. Sklad: maka, koncentrat bialka sojowego, 2,6% sezam, maka pszenna, otreby pszenne, wlokno jablkowe'
WHERE id = 129;

UPDATE restrictions SET
  reason = 'Maka pszenna i otreby pszenne to fruktany, koncentrat bialka sojowego to przetworzona soja, a wlokno jablkowe i otreby to blonnik nierozpuszczalny, czyli ten, po ktorym stolec twardnieje. Wszystkie trzy podstawy sa na czarnej liscie',
  source = 'etykieta odczytana 10.08.2026',
  max_amount = 'maks. 2 kromki dziennie do 13.08; od 14.08 pudelka i chleb wychodzi z rotacji',
  date_to = '2026-08-13'
WHERE id = 45;
