-- Rollback untuk 0008_recommendations.sql. `calculation_traces` dulu: ia merujuk `recommendations`.
DROP TABLE IF EXISTS `calculation_traces`;
--> statement-breakpoint
DROP TABLE IF EXISTS `recommendations`;
