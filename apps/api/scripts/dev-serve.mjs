// Menyalakan API dari `dist/` untuk uji tangan — dipakai scripts/dev-up.ps1.
//
// Isinya sama dengan bootstrap inline di scripts/dev-up.sh. Di Windows bootstrap itu
// tidak bisa ditaruh di `node -e`: Start-Process memecah argumen multibaris dengan cara
// yang berbeda dari bash, jadi kodenya dipindah ke berkas.
import { NestFactory } from '@nestjs/core';

const { AppModule } = await import('../dist/app.module.js');
const { ApiErrorFilter } = await import('../dist/shared/http/api-error.filter.js');

const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
app.setGlobalPrefix('api/v1', { exclude: ['health'] });
app.useGlobalFilters(new ApiErrorFilter());
await app.listen(process.env.PORT);
console.log('API siap');
