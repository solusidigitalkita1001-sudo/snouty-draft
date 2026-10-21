-- Rollback untuk 0030: peta kehilangan titik kota; agregat provinsi tetap.
ALTER TABLE `market_events`
  DROP COLUMN `lng`,
  DROP COLUMN `lat`,
  DROP COLUMN `city`;
