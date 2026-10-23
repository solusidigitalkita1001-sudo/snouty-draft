/**
 * Pemberitahuan di dalam aplikasi (P27-07). Modul yang MENGHASILKAN kejadian bergantung pada
 * `NOTIFIER` (port di `shared/notification`), bukan pada modul ini — arah dependensinya satu arah.
 */
import { Global, Module } from '@nestjs/common';
import { LoggerService } from '../../shared/logging/logger.service.js';
import { NOTIFIER } from '../../shared/notification/notifier.port.js';
import { NotificationService } from './application/notification.service.js';
import { NOTIFICATION_STORE, type NotificationStore } from './domain/notification.js';
import { notificationStoreProvider } from './infrastructure/mysql-notification.store.js';
import { NotificationController } from './presentation/notification.controller.js';

const notificationServiceProvider = {
  provide: NotificationService,
  inject: [NOTIFICATION_STORE, LoggerService],
  useFactory: (store: NotificationStore, logger: LoggerService) =>
    new NotificationService(store, logger.child({ module: 'notification' })),
};

@Global()
@Module({
  controllers: [NotificationController],
  providers: [
    notificationStoreProvider,
    notificationServiceProvider,
    { provide: NOTIFIER, useExisting: NotificationService },
  ],
  exports: [NotificationService, NOTIFIER],
})
export class NotificationModule {}
