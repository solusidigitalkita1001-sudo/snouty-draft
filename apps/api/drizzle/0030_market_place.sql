-- P26-12 (pemilik 2026-10-21: "zone by province, klik → zoom ke sebaran titiknya"): event pasar
-- menyimpan kota perkiraan dan koordinat KASAR (dibulatkan 0,1° ≈ 11 km) supaya peta punya titik di
-- dalam provinsi. Tetap tanpa identitas: barisnya sama anonimnya, dan tampilan tetap memakai ambang
-- k-anonimitas 5 (docs/MARKET_INTELLIGENCE.md §5).
ALTER TABLE `market_events`
  ADD COLUMN `city` varchar(120) NULL AFTER `region`,
  ADD COLUMN `lat` decimal(4,1) NULL AFTER `city`,
  ADD COLUMN `lng` decimal(5,1) NULL AFTER `lat`;
