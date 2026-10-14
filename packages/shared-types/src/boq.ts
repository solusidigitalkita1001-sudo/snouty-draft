/**
 * BOQ — satu sumber untuk tab Estimasi Material, tab Produk Pralon, dan laporan PDF (DD-01 #4, #8).
 *
 * Sebelumnya tab Produk membaca `products` dan tabel material membaca `bom`, sehingga keduanya
 * bisa berbeda isi, urutan, dan nama. Di sini keduanya diturunkan dari daftar yang sama: baris BOQ
 * dulu, lalu kartu produk = baris BOQ yang dikelompokkan per SKU, lengkap dengan jumlah dan nomor
 * baris BOQ-nya. Produk terpilih yang jumlahnya belum bisa dihitung tetap menjadi baris BOQ
 * (tanpa nomor dan tanpa angka) — tidak disembunyikan, tidak diberi angka karangan.
 */

import type { Provenance } from './provenance.js';
import type { BomCalc, BomItem, BomSystem, SelectedProduct } from './recommendation.js';

export interface BoqRow {
  /** Nomor baris BOQ; `null` untuk baris yang jumlahnya belum bisa dihitung. */
  readonly no: number | null;
  readonly kind: 'pipe' | 'fitting';
  /** Peruntukan ("Pipa utama", "Ventilasi air kotor"); kosong pada rekomendasi lama. */
  readonly purpose?: string;
  /** Nama item dari engine ("Pipa PVC AW", "Tee cabang"). */
  readonly item: string;
  readonly productId?: string;
  /** Nama katalog produk Pralon untuk baris ini, bila produknya terpilih. */
  readonly productName?: string;
  readonly size: string;
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly netLengthM?: number;
  /** Teks dasar perhitungan dari trace — dipakai bila `calc` tidak ada (rekomendasi lama). */
  readonly basis?: string;
  readonly calc?: BomCalc;
  readonly provenance?: Provenance;
  /** Produk terpilih yang jumlahnya belum bisa dihitung. */
  readonly pending?: true;
  /**
   * Baris tanpa SKU katalog Pralon (review putaran 4, 5a — dulu "LIHAT DOKUMEN TEKNIS" juga menempel
   * di fitting ber-SKU yang kelasnya belum terverifikasi, sehingga labelnya kehilangan arti):
   * `not_in_catalog` = Pralon tidak punya barangnya di katalog, pakai produk setara;
   * `ask_pralon` = lini produk Pralon yang belum ada di data katalog (Solvent Cement).
   */
  readonly availability?: 'not_in_catalog' | 'ask_pralon';
}

export interface BoqSection {
  /** `null` = rekomendasi tanpa pembagian sistem (lama, atau kasus teknis/irigasi). */
  readonly system: BomSystem | null;
  /** Pipa lebih dulu, lalu fitting; baris tanpa jumlah di akhir kelompoknya. */
  readonly rows: readonly BoqRow[];
}

export interface BoqProduct {
  readonly productId: string;
  readonly name?: string;
  readonly system: BomSystem | null;
  readonly kind: 'pipe' | 'fitting';
  /** Jumlah total di BOQ; `null` bila belum bisa dihitung atau satuannya berbeda antar baris. */
  readonly quantity: number | null;
  readonly unit: string | null;
  /** Nomor baris BOQ tempat produk ini dihitung. */
  readonly rowNos: readonly number[];
  readonly selections: readonly SelectedProduct[];
}

export interface Boq {
  readonly sections: readonly BoqSection[];
  readonly products: readonly BoqProduct[];
}

const SYSTEM_ORDER: readonly (BomSystem | null)[] = ['clean_water', 'soil', 'waste', null];

/** Fitting dan aksesori dihitung per buah/kaleng; pipa per batang atau meter. */
function kindOfUnit(unit: string): 'pipe' | 'fitting' {
  return unit === 'pcs' || unit === 'kaleng' ? 'fitting' : 'pipe';
}

/**
 * Nama katalog persis, hanya format ukurannya diseragamkan: master ERP kadang menulis `Socket DV 2 "`
 * (spasi sebelum tanda inci) di samping `Socket DV 2"` (review putaran 4, 5c).
 */
export function displayName(name: string | undefined): string | undefined {
  return name
    ?.replace(/\s+(["”])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function joined(values: readonly (string | undefined)[]): string | undefined {
  const unique = [...new Set(values.filter((v): v is string => Boolean(v)))];
  return unique.length > 0 ? unique.join(' · ') : undefined;
}

export function boqFrom(recommendation: {
  readonly products: readonly SelectedProduct[];
  readonly bom: readonly BomItem[];
}): Boq {
  const usable = recommendation.products.filter((p) => p.matchState !== 'INFORMATION_UNAVAILABLE');
  const selectionsOf = (productId: string) => usable.filter((p) => p.productId === productId);

  type Draft = Omit<BoqRow, 'no'> & { readonly system: BomSystem | null };
  const drafts: Draft[] = recommendation.bom.map((item) => {
    const selections = item.productId ? selectionsOf(item.productId) : [];
    const productName = displayName(selections.find((s) => s.name !== undefined)?.name);
    // Status hanya untuk baris TANPA SKU; kelas fitting yang belum terverifikasi dicatat di tab Produk.
    const availability =
      productName === undefined
        ? { availability: item.askPralon ? ('ask_pralon' as const) : ('not_in_catalog' as const) }
        : {};
    if (item.pending) {
      return {
        system: item.system ?? null,
        kind: kindOfUnit(item.unit),
        ...(item.purpose !== undefined ? { purpose: item.purpose } : {}),
        item: item.item,
        ...(item.productId !== undefined && selections.length > 0
          ? { productId: item.productId }
          : {}),
        ...(productName !== undefined ? { productName } : {}),
        size: item.size,
        quantity: null,
        unit: null,
        pending: true,
        ...availability,
      };
    }
    const purpose = item.purpose ?? joined(selections.map((s) => s.purpose));
    return {
      system: item.system ?? selections.find((s) => s.system)?.system ?? null,
      kind: kindOfUnit(item.unit),
      ...(purpose !== undefined ? { purpose } : {}),
      item: item.item,
      ...(item.productId !== undefined ? { productId: item.productId } : {}),
      ...(productName !== undefined ? { productName } : {}),
      size: item.size,
      quantity: item.quantity,
      unit: item.unit,
      ...(item.netLengthM !== undefined ? { netLengthM: item.netLengthM } : {}),
      basis: item.basis,
      ...(item.calc !== undefined ? { calc: item.calc } : {}),
      provenance: item.provenance,
      ...availability,
    };
  });

  // Produk terpilih tanpa baris BOQ sama sekali: satu baris per SKU dengan semua peruntukannya.
  // Baris tertunda (sok, dop) sudah membawa produknya — tidak diulang.
  const counted = new Set(recommendation.bom.map((b) => b.productId).filter(Boolean));
  const pendingIds = [...new Set(usable.map((p) => p.productId))].filter((id) => !counted.has(id));
  // Fitting sudah dihitung per jenis dan ukuran: fitting terpilih yang tidak punya baris jumlah
  // adalah sisa pencocokan (mis. tee cabang di rumah yang cabangnya disambung elbow — 4b), bukan
  // barang yang dibutuhkan. Hanya rekomendasi tanpa hitungan fitting yang masih menampilkannya.
  const fittingsCounted = recommendation.bom.some(
    (b) => !b.pending && b.productId !== undefined && b.unit === 'pcs',
  );
  for (const productId of pendingIds) {
    const selections = selectionsOf(productId);
    if (fittingsCounted && selections.every((s) => s.role === 'fitting')) continue;
    const purpose = joined(selections.map((s) => s.purpose));
    const productName = displayName(selections.find((s) => s.name !== undefined)?.name);
    drafts.push({
      system: selections.find((s) => s.system)?.system ?? null,
      kind: selections.every((s) => s.role === 'fitting') ? 'fitting' : 'pipe',
      ...(purpose !== undefined ? { purpose } : {}),
      item: productName ?? productId,
      productId,
      ...(productName !== undefined ? { productName } : {}),
      size: joined(selections.map((s) => s.size)) ?? '',
      quantity: null,
      unit: null,
      pending: true,
    });
  }

  let next = 1;
  const sections: BoqSection[] = [];
  for (const system of SYSTEM_ORDER) {
    const inSystem = drafts.filter((d) => d.system === system);
    if (inSystem.length === 0) continue;
    const ordered = (['pipe', 'fitting'] as const).flatMap((kind) => [
      ...inSystem.filter((d) => d.kind === kind && !d.pending),
      ...inSystem.filter((d) => d.kind === kind && d.pending),
    ]);
    sections.push({
      system,
      rows: ordered.map(({ system: _system, ...row }) => ({
        ...row,
        no: row.pending ? null : next++,
      })),
    });
  }

  return { sections, products: productsFrom(sections, selectionsOf) };
}

function productsFrom(
  sections: readonly BoqSection[],
  selectionsOf: (productId: string) => readonly SelectedProduct[],
): readonly BoqProduct[] {
  const order: string[] = [];
  const rowsById = new Map<string, { system: BomSystem | null; rows: BoqRow[] }>();
  for (const section of sections) {
    for (const row of section.rows) {
      if (row.productId === undefined) continue;
      const entry = rowsById.get(row.productId);
      if (entry) entry.rows.push(row);
      else {
        rowsById.set(row.productId, { system: section.system, rows: [row] });
        order.push(row.productId);
      }
    }
  }
  return order.map((productId) => {
    const { system, rows } = rowsById.get(productId)!;
    const units = new Set(rows.map((r) => r.unit));
    const allCounted = rows.every((r) => r.quantity !== null);
    const sameUnit = units.size === 1 && allCounted;
    const name = rows.find((r) => r.productName !== undefined)?.productName;
    return {
      productId,
      ...(name !== undefined ? { name } : {}),
      system,
      kind: rows[0]!.kind,
      quantity: sameUnit ? rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0) : null,
      unit: sameUnit ? rows[0]!.unit : null,
      rowNos: rows.map((r) => r.no).filter((n): n is number => n !== null),
      selections: selectionsOf(productId),
    };
  });
}
