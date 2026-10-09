/**
 * Apa yang dihitung sebagai SATU produk (audit anti-halusinasi 2026-10-09).
 *
 * Katalog ERP memuat satu baris per SKU, tetapi beberapa SKU adalah catatan yang sama: salinan
 * ERP bertanda "(copy)" ("Pipa HDPE Gas SDR-13,6 50 mm x 100 Meter Kuning (copy)" di samping
 * "… SDR-13.6 50 mm …"), desimal ditulis dengan koma atau titik, dan 14 pasang fitting bernama
 * persis sama dengan kode ERP berbeda. Jumlah produk dihitung per nama kanonik — SKU yang namanya
 * sama dihitung sekali — dan jumlah SKU tetap dilaporkan supaya selisihnya terlihat, bukan
 * disembunyikan. Aturan yang sama dipakai SQL hitungan (`catalog.mysql.repository.ts`) dan diuji
 * terhadap MySQL sungguhan.
 */

/** Penanda salinan ERP di akhir nama. */
const COPY_MARK = /\s*\(copy\)\s*$/i;

export function canonicalProductName(name: string): string {
  return name
    .replace(COPY_MARK, '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Satu nama per produk kanonik, urutan masukan dipertahankan (nama asli yang pertama). */
export function distinctProductNames(names: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const key = canonicalProductName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

const DESIGNATION = /\b(PN|SDR)[- ]?(\d+(?:[.,]\d+)?)\b/gi;

/**
 * Kelas tekanan/dimensi yang TERTULIS di nama produk ("PN-12,5" → "PN-12.5"), tanpa duplikat,
 * urut: PN naik, lalu SDR naik. Hanya yang tertulis — produk tanpa penanda tidak diberi kelas.
 */
export function designationsOf(names: readonly string[]): readonly string[] {
  const found = new Map<string, { kind: string; value: number }>();
  for (const name of names) {
    for (const m of name.matchAll(DESIGNATION)) {
      const kind = m[1]!.toUpperCase();
      const raw = m[2]!.replace(',', '.');
      found.set(`${kind}-${raw}`, { kind, value: Number.parseFloat(raw) });
    }
  }
  return [...found.entries()]
    .sort(([, a], [, b]) => (a.kind === b.kind ? a.value - b.value : a.kind === 'PN' ? -1 : 1))
    .map(([label]) => label);
}
