-- Ostatnia notatka powolujaca sie na elastaze 151. Przeslanke odrzucil
-- audyt 15.08.2026 (migracja 047: gastrolog uznala elastaze za klinicznie
-- nieistotna 15.05, repo potwierdzilo 10.08 przy odstawianiu karczocha
-- i Essentiale). Rada "odsacz olej" zostaje, bo ma inne, prawdziwe
-- uzasadnienie: tluszcz z zalewy liczy sie do pasma dnia.
-- Odwracalne: przywrocic poprzednia tresc notatki.

UPDATE foods
SET notes = 'Wędzone. Odsączyć olej: tłuszcz z zalewy liczy się do pasma dnia'
WHERE id = 32 AND name = 'szproty';
