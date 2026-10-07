-- Fase 16 (P16-01): subjek percakapan aktif hidup di `requirement_snapshots.state.subject`; giliran yang
-- hanya mengubah subjek (pertanyaan perusahaan/produk) menulis snapshot dengan pemicu `subject_change`.
ALTER TABLE `requirement_snapshots` DROP CHECK `ck_snapshots_trigger`;
--> statement-breakpoint
ALTER TABLE `requirement_snapshots` ADD CONSTRAINT `ck_snapshots_trigger` CHECK (`trigger` IN ('extraction','clarification_answer','user_edit','default_applied','subject_change'));
