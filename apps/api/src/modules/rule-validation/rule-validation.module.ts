/**
 * Validasi aturan teknik (P31-82) — layar tempat ahli pipa Pralon menandatangani aturan hitung.
 *
 * Modulnya tidak mengimpor modul lain: aturannya datang dari paket `@snouty/engineering` yang
 * murni, dan tanda tangannya satu tabel sendiri. Nama penanda tangan dibaca lewat join di
 * repositori, bukan lewat modul identity — tidak ada ketergantungan baru antar modul.
 */
import { Module } from '@nestjs/common';
import { InternalRoleGuard } from '../../shared/http/internal-role.guard.js';
import { RuleValidationService } from './application/rule-validation.service.js';
import {
  RULE_SIGN_OFF_REPOSITORY,
  type RuleSignOffRepository,
} from './domain/rule-sign-off.repository.js';
import { ruleSignOffRepositoryProvider } from './infrastructure/mysql-rule-sign-off.repository.js';
import { RuleValidationController } from './presentation/rule-validation.controller.js';

const ruleValidationServiceProvider = {
  provide: RuleValidationService,
  inject: [RULE_SIGN_OFF_REPOSITORY],
  useFactory: (signOffs: RuleSignOffRepository) => new RuleValidationService(signOffs),
};

@Module({
  controllers: [RuleValidationController],
  providers: [ruleSignOffRepositoryProvider, ruleValidationServiceProvider, InternalRoleGuard],
  exports: [ruleValidationServiceProvider],
})
export class RuleValidationModule {}
