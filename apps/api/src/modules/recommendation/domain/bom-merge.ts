/**
 * Satu baris material per produk katalog (temuan laporan SNTY-2026-10-0002: "Pipa PVC AW 3/4" 4
 * batang" dan "Pipa PVC AW 3/4" 6 batang" tercetak sebagai dua baris). Baris dengan `productId` dan
 * satuan yang sama digabung: jumlahnya dijumlahkan, nama perannya disebut berurutan, dasar
 * perhitungan dan trace keduanya dipertahankan. Baris tanpa produk tidak disentuh.
 *
 * Jumlah dijumlahkan apa adanya (setiap peran sudah dibulatkan ke batang utuh): tidak ada asumsi
 * baru bahwa potongan satu jalur bisa dipakai jalur lain.
 */
import type { BomItem, Provenance } from '@snouty/shared-types';

const ORDER: readonly Provenance[] = ['VERIFIED', 'ESTIMATED', 'ASSUMED', 'UNAVAILABLE'];
const weaker = (a: Provenance, b: Provenance) => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

export function mergeBomBySku(items: readonly BomItem[]): readonly BomItem[] {
  const out: BomItem[] = [];
  const indexByKey = new Map<string, number>();
  for (const item of items) {
    if (item.productId === undefined) {
      out.push(item);
      continue;
    }
    // Sistem ikut kunci (review laporan 0015): pipa 2" ventilasi air kotor dan pipa 2" air bekas
    // adalah SKU sama, tetapi bagian BOQ-nya berbeda.
    const key = `${item.productId}|${item.unit}|${item.system ?? ''}`;
    const at = indexByKey.get(key);
    if (at === undefined) {
      indexByKey.set(key, out.length);
      out.push(item);
      continue;
    }
    const prev = out[at]!;
    out[at] = {
      ...prev,
      item: prev.item === item.item ? prev.item : `${prev.item} + ${item.item}`,
      ...mergedPurpose(prev.purpose, item.purpose),
      ...(prev.netLengthM !== undefined && item.netLengthM !== undefined
        ? { netLengthM: Math.round((prev.netLengthM + item.netLengthM) * 10) / 10 }
        : {}),
      quantity: prev.quantity + item.quantity,
      ...(prev.calc !== undefined && item.calc !== undefined
        ? {
            calc: {
              method: `${prev.calc.method} · ${item.calc.method}`,
              working: `${prev.calc.working} · ${item.calc.working}`,
              result: `${prev.quantity + item.quantity} ${prev.unit}`,
            },
          }
        : {}),
      basis: `${prev.basis} ${item.basis}`.trim(),
      provenance: weaker(prev.provenance, item.provenance),
      traceIds: [...new Set([...prev.traceIds, ...item.traceIds])],
      ...(prev.subtotal !== undefined && item.subtotal !== undefined
        ? { subtotal: prev.subtotal + item.subtotal }
        : {}),
    };
  }
  return out;
}

/** Dua peruntukan satu SKU ditulis berdampingan ("Pipa utama · Cabang"), tanpa pengulangan. */
function mergedPurpose(a: string | undefined, b: string | undefined): { purpose?: string } {
  const parts = [...new Set([...(a?.split(' · ') ?? []), ...(b?.split(' · ') ?? [])])];
  return parts.length > 0 ? { purpose: parts.join(' · ') } : {};
}
