-- P26-07: penulis `market_events`. Satu event per konsultasi — penanda disimpan di sisi PERCAKAPAN
-- (yang memang beridentitas), bukan di event pasar: `market_events` tetap tanpa kolom yang bisa
-- dihubungkan kembali ke orang (docs/MARKET_INTELLIGENCE.md §3).
ALTER TABLE `conversations`
  ADD COLUMN `market_recorded_at` datetime(3) NULL AFTER `pinned_at`;
