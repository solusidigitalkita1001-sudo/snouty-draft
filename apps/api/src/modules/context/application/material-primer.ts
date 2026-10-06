/**
 * Primer bahan pipa — pengetahuan umum KUALITATIF yang dimiliki kode, bukan model.
 *
 * Mengapa ada: jalur `PRODUCT_FAQ` ("apa bedanya PVC dan HDPE?") mula-mula membiarkan model
 * menjelaskan dari ingatannya; qwen2.5:7b menukar sifatnya (PVC disebut lentur, HDPE kaku).
 * Aturan proyek: fakta hidup di kode, model merangkai kalimat. Jadi sifat tiap keluarga bahan
 * ditulis di sini, masuk blok DATA, dan tanpa model pun teks ini yang tampil.
 *
 * Sengaja tanpa angka (tekanan, suhu, umur pakai, standar) — yang berangka hanya boleh datang
 * dari katalog dengan sumber. Redaksinya menunggu tinjauan tim teknis Pralon (OQ-45).
 */

export interface MaterialPrimer {
  readonly family: string;
  readonly pattern: RegExp;
  readonly text: string;
}

export const MATERIAL_PRIMERS: readonly MaterialPrimer[] = [
  {
    family: 'PVC',
    pattern: /\b(u?pvc|paralon)\b/i,
    text: 'PVC (uPVC) adalah pipa plastik yang kaku dan ringan, disambung dengan lem (solvent cement) atau fitting bercincin karet, lazim untuk jaringan air bersih di dalam dan sekitar bangunan. Ia tidak lentur, sehingga belokan memakai fitting, dan tidak untuk air panas.',
  },
  {
    family: 'HDPE',
    pattern: /\b(hdpe|pe\s?100|pe\s?80|polyethylene|polietilen)\b/i,
    text: 'HDPE adalah pipa plastik yang lentur dan ulet, disambung dengan pemanasan (butt fusion / electrofusion) atau fitting kompresi, lazim untuk jalur tanam, jaringan distribusi luar bangunan, dan jalur yang menuntut sedikit sambungan karena bisa digulung. Tidak dilem.',
  },
  {
    family: 'PPR',
    pattern: /\b(ppr|pp-r|polypropylene)\b/i,
    text: 'PPR adalah pipa plastik yang disambung dengan pemanasan (heat fusion) sehingga sambungannya menyatu, lazim untuk instalasi air panas dan dingin di dalam bangunan. Tidak dilem, butuh alat pemanas khusus.',
  },
  {
    family: 'Galvanis',
    pattern: /\b(galvanis|gip|besi|baja)\b/i,
    text: 'Pipa galvanis (GIP) adalah pipa baja berlapis seng, disambung dengan ulir atau las, kuat terhadap benturan tetapi berat dan lama-kelamaan bisa berkarat di dalam. Kini umumnya digantikan pipa plastik untuk air bersih.',
  },
];

/** Primer untuk keluarga bahan yang disebut di pesan/kueri; urutannya mengikuti daftar di atas. */
export function primersFor(...texts: readonly (string | null | undefined)[]): readonly string[] {
  const haystack = texts.filter((t): t is string => typeof t === 'string').join(' ');
  return MATERIAL_PRIMERS.filter((p) => p.pattern.test(haystack)).map((p) => p.text);
}
