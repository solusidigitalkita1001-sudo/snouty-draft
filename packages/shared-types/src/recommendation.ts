/**
 * Agregat Recommendation — hasil konsultasi yang bisa dibaca, disimpan, dan diaudit.
 * docs/DOMAIN_MODEL.md §7 · SPEC §8.
 *
 * Dua invarian membentuk tipe-tipe di sini:
 *
 * **REC-1.** `headline` dan `body` adalah prosa LLM yang **hanya menjelaskan** angka
 * yang sudah dihitung. Angka di dalamnya diekstrak dan dicocokkan dengan `stats`,
 * `SystemLine`, dan `BomItem`; yang tidak cocok membuat prosanya dibuang.
 *
 * **T-1.** Setiap nilai teknik yang tampil punya minimal satu trace — karena itu
 * `SystemLine` dan `BomItem` membawa `traceIds`, dan kolom "DASAR PERHITUNGAN"
 * dirender dari trace, bukan dari prosa.
 */

import type { KeyValue } from './assistant-card.js';
import type { Provenance } from './provenance.js';
import type { ProductMatchState } from './catalog.js';
import type { BuildingType } from './requirement.js';

/** Lima statistik di layar 06. */
export interface RecommendationStats {
  readonly outletCount: number;
  readonly mainSize: string;
  readonly branchCount: number;
  readonly fixtureConnectionSize: string;
  readonly productCount: number;
}

/** Peran sebuah baris/segmen dalam sistem — juga menentukan warna bar di UI. */
export type SystemRole = 'main' | 'riser' | 'branch' | 'fixture' | 'fitting';

/**
 * Sistem tempat sebuah baris material atau produk dipakai — membagi BOQ menjadi bagian
 * (DD-01 #8). Ventilasi ikut jalurnya: ventilasi air kotor di `soil`, air bekas di `waste`.
 */
export type BomSystem = 'clean_water' | 'soil' | 'waste';

/** Satu baris tabel "Rekomendasi Sistem" (layar 06). */
/** Satu langkah hitung yang bisa dibaca pengguna — judul + penjelasan aturan, tanpa kode aturan. */
export interface CalculationStep {
  readonly title: string;
  readonly text: string;
}

export interface SystemLine {
  readonly name: string;
  readonly path: string;
  readonly size: string;
  readonly reason: string;
  readonly provenance: Provenance;
  readonly traceIds: readonly string[];
  readonly role: SystemRole;
  /** Langkah hitung jalur ini, berurutan — panel "detail teknis". Rekomendasi lama tidak punya. */
  readonly steps?: readonly CalculationStep[];
}

export interface SelectedProduct {
  readonly productId: string;
  readonly size: string;
  readonly role: SystemRole;
  readonly matchState: ProductMatchState;
  readonly reason: string;
  /**
   * Varian lain yang sama-sama cocok (katalog Pralon: ujung, warna, panjang batang, merek) —
   * ≤ 10, urut kriteria pemilihan yang sama (docs/MATCHER_V2_PROPOSAL.md §1). Kartu menampilkan
   * satu; drawer boleh menampilkan sisanya.
   */
  readonly alternatives?: readonly { readonly productId: string; readonly name: string }[];
  /** Nama katalog produk terpilih — untuk baris material yang jumlahnya menyusul (TC-H-05). */
  readonly name?: string;
  /**
   * Peruntukan dalam bahasa percakapan ("Pipa utama", "Air kotor", "Ventilasi air bekas") — lebih
   * tepat daripada `role`, yang sama untuk pipa utama air bersih dan jalur air kotor (TC-H-05/06).
   */
  readonly purpose?: string;
  /** Sistem tempat produk ini dipakai (DD-01); rekomendasi lama tidak punya. */
  readonly system?: BomSystem;
}

/**
 * Satu SKU dalam solusi (TC-H-05): tab Produk, daftar material, ringkasan "Ada N produk Pralon",
 * dan `stats.productCount` diturunkan dari daftar yang sama. Satu SKU bisa melayani beberapa peran
 * (pipa utama + riser); `counted` = punya baris jumlah di material, selain itu jumlahnya menyusul.
 */
export interface SkuLine {
  readonly productId: string;
  readonly name?: string;
  readonly selections: readonly SelectedProduct[];
  readonly counted: boolean;
  readonly kind: 'pipe' | 'fitting';
}

export function skuLines(recommendation: {
  readonly products: readonly SelectedProduct[];
  readonly bom: readonly { readonly productId?: string }[];
}): readonly SkuLine[] {
  const counted = new Set(recommendation.bom.map((b) => b.productId).filter(Boolean));
  const order: string[] = [];
  const byId = new Map<string, SelectedProduct[]>();
  for (const product of recommendation.products) {
    if (product.matchState === 'INFORMATION_UNAVAILABLE') continue;
    if (!byId.has(product.productId)) {
      byId.set(product.productId, []);
      order.push(product.productId);
    }
    byId.get(product.productId)!.push(product);
  }
  return order.map((productId) => {
    const selections = byId.get(productId)!;
    const named = selections.find((s) => s.name !== undefined);
    return {
      productId,
      ...(named?.name !== undefined ? { name: named.name } : {}),
      selections,
      counted: counted.has(productId),
      kind: selections.every((s) => s.role === 'fitting') ? 'fitting' : 'pipe',
    };
  });
}

export type BomUnit = 'batang' | 'pcs' | 'kaleng' | 'meter';

/**
 * Dasar perhitungan satu baris BOQ, dari kode yang menghitungnya (bukan dipecah dari kalimat):
 * dari mana panjang/jumlahnya, hitungannya, dan hasilnya.
 */
export interface BomCalc {
  /** "Panjang + lebar bangunan dan beda tinggi ke titik air tertinggi". */
  readonly method: string;
  /** "25,5 m ÷ 4 m = 6,38". */
  readonly working: string;
  /** "7 batang". */
  readonly result: string;
}

/** Statistik layar 06 untuk solusi IRIGASI (OQ-47) — menggantikan lima statistik bangunan. */
export interface IrrigationStats {
  readonly areaHa: number;
  readonly designFlowLs: number;
  readonly mainSize: string;
  readonly pumpRequired: boolean;
  readonly productCount: number;
}

export interface BomItem {
  readonly item: string;
  /**
   * Produk katalog yang dihitung jumlah belinya. Baris dengan produk yang sama digabung
   * (`mergeBomBySku`) — dua peran (mis. transfer + riser) tidak lagi menjadi dua baris SKU sama.
   */
  readonly productId?: string;
  readonly size: string;
  readonly quantity: number;
  readonly unit: BomUnit;
  /** Teks kolom "DASAR PERHITUNGAN" — dari trace aturan, bukan dari prosa LLM. */
  readonly basis: string;
  readonly provenance: Provenance;
  readonly traceIds: readonly string[];
  /** Bagian BOQ (DD-01 #8); rekomendasi lama tidak punya → bagian "Material". */
  readonly system?: BomSystem;
  /** Peruntukan dalam bahasa pengguna ("Pipa utama", "Cabang") — kolom Uraian BOQ. */
  readonly purpose?: string;
  /** Panjang bersih pipa sebelum dibulatkan ke batang — kolom Keterangan BOQ. */
  readonly netLengthM?: number;
  /** Hitungan baris ini dalam tiga bagian — tabel "Dasar perhitungan" (DD-01 #9). */
  readonly calc?: BomCalc;
  /** Hanya bila `PRICING_ENABLED` (OQ-03). */
  readonly unitPrice?: number;
  readonly subtotal?: number;
}

export interface Assumption {
  readonly text: string;
  /**
   * Field kebutuhan yang terdampak. Inilah yang membuat "Perbaiki asumsi ini →"
   * bisa membuka field yang tepat alih-alih melempar pengguna ke awal percakapan.
   * Kosong = baris penjelasan cara hitung, bukan asumsi yang bisa diubah (tanpa tombol).
   */
  readonly fieldPath: string;
  readonly ruleId?: string;
  /**
   * ID di registry asumsi terpusat (`packages/engineering/src/parameters/assumptions.ts`)
   * bila nilai ini lahir dari sana — supaya asumsi yang sama tampil dengan identitas yang
   * sama di setiap kasus dan bisa diganti nilainya di satu tempat.
   */
  readonly assumptionId?: string;
  /** Nilai angka asumsi saat ini — ada berarti baris ini bisa diganti nilainya di tempat. */
  readonly value?: number;
  readonly unit?: string;
  /** Nilai ini dari pengguna (menggantikan asumsi baku), bukan tebakan sistem. */
  readonly userSet?: boolean;
}

/** Status kandidat ukuran — kosakata tertutup dari engine (Kelompok F/H), label di UI. */
export type OptionStatus = 'ok' | 'too_fast' | 'too_slow' | 'high_loss' | 'too_small';

/**
 * Satu kandidat ukuran pipa yang DIPERTIMBANGKAN engine (brief Fase 14 §28 "Opsi"):
 * bukan hanya yang dipilih, supaya tradeoff-nya terlihat. Angka dari engine, catatan dari kode.
 */
export interface SolutionOption {
  readonly size: string;
  readonly status: OptionStatus;
  /** Dipilih sebagai rekomendasi utama. */
  readonly recommended: boolean;
  /** Satu ukuran di atas rekomendasi: kerugian lebih rendah, biaya pipa lebih tinggi. */
  readonly alternative: boolean;
  /** Angka kandidat berlabel bahasa pengguna (kecepatan, kerugian gesek, kapasitas, …). */
  readonly metrics: readonly KeyValue[];
  /** Tradeoff dalam bahasa pengguna — deterministik dari status. */
  readonly note: string;
}

export type OutputReadiness = 'ready' | 'partial' | 'missing_data';

/** Kesiapan satu keluaran (pemilihan bahan, sizing pipa, pompa, …) dari `ReadinessResolver`. */
export interface ReadinessItem {
  readonly output: string;
  readonly label: string;
  readonly readiness: OutputReadiness;
  /** Label parameter wajib yang masih kurang. */
  readonly missing: readonly string[];
  /** Label parameter yang akan memperbaiki hasil. */
  readonly improvable: readonly string[];
}

/**
 * Bagian tetap jawaban teknis (brief §28), diisi dari state dan hasil engine — bukan dari model.
 * Ringkasan = `headline`/`body`, Asumsi = `assumptions`, Produk = `products`; yang di sini adalah
 * bagian yang sebelumnya tidak punya tempat: data diketahui, perhitungan, opsi, kesiapan, data kurang.
 */
export interface ComposedResponse {
  /** Data yang diketahui — parameter dari pengguna (`origin: known`), label + nilai bersatuan. */
  readonly knownData: readonly KeyValue[];
  /** Parameter yang diisi asumsi (`origin: assumed`) — berdampingan dengan asumsi engine. */
  readonly assumedData: readonly KeyValue[];
  /** Perhitungan: satu baris per aturan yang dijalankan, penjelasan dari trace. */
  readonly calculations: readonly KeyValue[];
  readonly options: readonly SolutionOption[];
  readonly readiness: readonly ReadinessItem[];
  /** Data yang masih dibutuhkan: label parameter → pertanyaan bahasa pengguna (maks. 4). */
  readonly missingData: readonly KeyValue[];
}

/**
 * Satu butir kebutuhan di Ringkasan bergambar (DD-01 #1): apa yang dilayani instalasi ini, dari
 * data hitungan engine — bukan dari teks percakapan. Teks dan gambarnya dipilih tampilan.
 */
export type NeedKind =
  | 'building'
  | 'bathroom'
  | 'water_closet'
  | 'basin'
  | 'kitchen'
  | 'urinal'
  | 'wudhu_tap'
  | 'rooftop_tank'
  | 'ground_tank'
  | 'municipal'
  | 'well_pump'
  | 'booster_pump'
  | 'drainage';

export interface SolutionNeed {
  readonly kind: NeedKind;
  readonly count: number;
  /** Sebaran per lantai, lantai teratas lebih dulu (perkiraan engine bila denah belum ada). */
  readonly perFloor?: readonly { readonly floor: number; readonly count: number }[];
  /** Hanya `kind: 'building'`. */
  readonly building?: {
    readonly type: BuildingType;
    readonly floors: number;
    readonly floorHeightM: number;
    readonly lengthM?: number;
    readonly widthM?: number;
  };
  /** `booster_pump`: sisa tekanan di titik air tertinggi tanpa pompa. */
  readonly residualBar?: number;
  /** `drainage`: ukuran jalur air kotor dan air bekas. */
  readonly soilSize?: string;
  readonly wasteSize?: string;
}

export interface Recommendation {
  readonly id: string;
  readonly conversationId: string;
  readonly snapshotId: string;
  /** Dibekukan saat pembuatan — laporan lama tetap menjelaskan katalog yang dipakai. */
  readonly catalogVersionId: string;
  readonly headline: string;
  readonly body: string;
  /** Jalur guna; tidak ada = bangunan (rekomendasi lama). `technical` = kasus teknis umum (Fase 14). */
  readonly kind?: 'building' | 'irrigation' | 'technical';
  readonly stats: RecommendationStats;
  /** Hanya untuk `kind: 'irrigation'`; `stats` tetap terisi demi pembaca lama. */
  readonly irrigationStats?: IrrigationStats;
  /** Statistik ringkasan kasus teknis umum (`kind: 'technical'`), label bahasa pengguna. */
  readonly highlights?: readonly KeyValue[];
  /** Bagian tetap jawaban teknis (Fase 14 §28); hanya `kind: 'technical'`. */
  readonly composition?: ComposedResponse;
  readonly systemLines: readonly SystemLine[];
  /** Kebutuhan bergambar di Ringkasan (DD-01 #1); hanya solusi bangunan yang dihitung sejak P17-04. */
  readonly needs?: readonly SolutionNeed[];
  readonly products: readonly SelectedProduct[];
  readonly bom: readonly BomItem[];
  readonly assumptions: readonly Assumption[];
  /** Provenance paling lemah di seluruh isi — satu asumsi membuat solusinya asumsi. */
  readonly overallProvenance: Provenance;
  readonly createdAt: string;
  /**
   * Hanya di respons `GET /recommendations/:id`: dihitung dengan aturan yang sudah diganti atau
   * dihapus. Tidak disimpan — dinilai saat dibaca dari trace-nya.
   */
  readonly outdated?: boolean;
}
