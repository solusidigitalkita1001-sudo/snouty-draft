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
    const key = `${item.productId}|${item.unit}`;
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
      quantity: prev.quantity + item.quantity,
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
