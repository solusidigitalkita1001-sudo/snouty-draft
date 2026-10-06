/**
 * Arahan produk UMUM untuk irigasi — dari pengetahuan milik kode, tanpa angka, tanpa
 * klaim produk Pralon tertentu (katalog Pralon belum terpasang; OQ-07). Yang dijelaskan:
 * apa yang menentukan pilihan dan ukuran, bahan mana yang lazim untuk bagian mana. Ukurannya
 * sendiri dihitung tim teknis (OQ-47).
 */
import type { RequirementState } from '@snouty/shared-types';
import { irrigationMissing } from '../domain/irrigation.js';
import { MATERIALS } from './pipe-knowledge.js';

const byFamily = (family: string) => MATERIALS.find((m) => m.family === family)!;

export function irrigationGuidance(state: RequirementState): string {
  const hdpe = byFamily('HDPE');
  const pvc = byFamily('PVC');
  const answers = state.useCase?.kind === 'irrigation' ? state.useCase.answers : {};
  const area = answers['irrigation.areaHa'];
  const opening = area
    ? `Untuk irigasi lahan ${area}, yang menentukan produk dan ukurannya bukan luasnya saja — melainkan **debit yang dibutuhkan, jarak dan beda tinggi dari sumber air, serta jenis irigasinya**.`
    : 'Untuk irigasi, yang menentukan produk dan ukurannya adalah **debit yang dibutuhkan, jarak dan beda tinggi dari sumber air, serta jenis irigasinya**.';
  const lines = [
    opening,
    '',
    `- **Jalur utama dari sumber ke lahan** (biasanya ditanam dan panjang): lazimnya ${hdpe.label} — ${hdpe.gist}, ${hdpe.durability}.`,
    `- **Distribusi di lahan / jalur tetap**: lazimnya ${pvc.label} — ${pvc.gist}; sambungannya ${pvc.joining}.`,
    '- **Pompa dan katup** menentukan tekanan yang harus ditahan pipa — kelas pipanya mengikuti itu.',
    '',
    irrigationMissing(state).length > 0
      ? 'Supaya tim teknis Pralon bisa menghitung ukuran dan menyusun daftar produknya, saya perlu beberapa hal di bawah ini.'
      : 'Data irigasinya sudah lengkap — perhitungan ukuran pipa irigasi dilakukan tim teknis Pralon dari data ini.',
  ];
  return lines.join('\n');
}
