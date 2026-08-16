-- 057: alias "swiezy"
--
-- Artefakt parsowania skladu: "Tymianek, swiezy" rozjechalo sie na przecinku
-- i zostal sam przymiotnik. Do zignorowania, nie jest produktem.

INSERT INTO food_aliases (alias, food_id, ignored, first_seen) VALUES
  ('świeży', NULL, 1, '2026-08-16')
ON CONFLICT(alias) DO UPDATE SET ignored = 1, food_id = NULL;
