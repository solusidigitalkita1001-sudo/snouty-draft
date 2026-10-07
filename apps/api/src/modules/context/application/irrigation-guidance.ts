/**
 * Arahan produk UMUM untuk irigasi — dari pengetahuan milik kode, tanpa angka, tanpa
 * klaim produk Pralon tertentu (katalog Pralon belum terpasang; OQ-07). Yang dijelaskan:
 * apa yang menentukan pilihan dan ukuran, bahan mana yang lazim untuk bagian mana. Ukurannya
 * sendiri dihitung tim teknis (OQ-47).
 */
import { DEFAULT_LOCALE, type Locale, type RequirementState } from '@snouty/shared-types';
import { irrigationMissing } from '../domain/irrigation.js';
import { MATERIALS } from './pipe-knowledge.js';

const byFamily = (family: string) => MATERIALS.find((m) => m.family === family)!;

/**
 * Redaksi Inggris dua bahan — `pipe-knowledge` belum dwibahasa, jadi frasa di sini diterjemahkan
 * setia dari `gist`/`durability`/`joining` entri HDPE dan PVC, tanpa tambahan fakta.
 */
const MATERIAL_EN = {
  HDPE: {
    gist: 'flexible and can be coiled',
    durability:
      'resists corrosion, impact, and ground movement; the black colour withstands sunlight; installation needs welding equipment and trained operators',
  },
  PVC: {
    gist: 'rigid and supplied in straight lengths',
    joining:
      'solvent cement or rubber ring — quick, no special tools, but a cemented joint cannot be taken apart',
  },
} as const;

export function irrigationGuidance(
  state: RequirementState,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (locale === 'en') return irrigationGuidanceEn(state);
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
      ? 'Supaya saya bisa menghitung debit, ukuran pipa, dan daftar produknya, saya perlu beberapa hal di bawah ini.'
      : 'Datanya sudah cukup. Tekan **Susun rekomendasi** dan saya hitung perkiraan awalnya — angka yang saya perkirakan sendiri saya tandai jelas, supaya tim teknis Pralon tinggal memeriksanya.',
  ];
  return lines.join('\n');
}

function irrigationGuidanceEn(state: RequirementState): string {
  const hdpe = MATERIAL_EN.HDPE;
  const pvc = MATERIAL_EN.PVC;
  const answers = state.useCase?.kind === 'irrigation' ? state.useCase.answers : {};
  const area = answers['irrigation.areaHa'];
  const opening = area
    ? `For irrigating ${area} of land, what decides the product and its size is not the area alone — it is **the flow required, the distance and height difference from the water source, and the type of irrigation**.`
    : 'For irrigation, what decides the product and its size is **the flow required, the distance and height difference from the water source, and the type of irrigation**.';
  const lines = [
    opening,
    '',
    `- **Main line from the source to the land** (usually buried and long): typically HDPE — ${hdpe.gist}, ${hdpe.durability}.`,
    `- **Distribution in the field / fixed lines**: typically PVC (uPVC) — ${pvc.gist}; joined with ${pvc.joining}.`,
    '- **Pumps and valves** set the pressure the pipe has to withstand — the pipe class follows from that.',
    '',
    irrigationMissing(state).length > 0
      ? 'So I can work out the flow, pipe sizes, and product list, I need a few details below.'
      : 'That is enough data. Press **Compose recommendation** and I will work out an initial estimate — figures I estimate myself are marked clearly, so the Pralon technical team only has to check them.',
  ];
  return lines.join('\n');
}
