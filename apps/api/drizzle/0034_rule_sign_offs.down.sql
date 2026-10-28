-- Rollback untuk 0034. Tanda tangan hilang, dan setiap aturan kembali berstatus
-- `REQUIRES_DOMAIN_VALIDATION` — yaitu kembali ke keadaan sebelum ada yang menandatangani.
DROP TABLE `rule_sign_offs`;
