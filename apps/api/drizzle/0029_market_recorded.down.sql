-- Rollback untuk 0029: penanda event pasar per konsultasi hilang; event yang sudah ada tetap.
ALTER TABLE `conversations`
  DROP COLUMN `market_recorded_at`;
