/**
 * Satu baris material per produk katalog (temuan laporan SNTY-2026-10-0002: "Pipa PVC AW 3/4" 4
 * batang" dan "Pipa PVC AW 3/4" 6 batang" tercetak sebagai dua baris). Baris dengan `productId` dan
 * satuan yang sama digabung: jumlahnya dijumlahkan, nama perannya disebut berurutan, dasar
 * perhitungan dan trace keduanya dipertahankan. Baris tanpa produk tidak disentuh.
 *
 * Pipa dengan batang yang sama dibulatkan SEKALI per SKU (review putaran 3, 4a): panjang bersih
 * semua perannya dijumlah, ditambah sisa potong, lalu dibagi panjang batang — bukan jumlah batang
 * per peran yang masing-masing sudah dibulatkan ke atas. Baris lain dijumlah apa adanya.
 */
import { DEFAULT_LOCALE, type BomItem, type Locale, type Provenance } from '@snouty/shared-types';
import { pipePurchase } from './pipe-quantity.js';

const ORDER: readonly Provenance[] = ['VERIFIED', 'ESTIMATED', 'ASSUMED', 'UNAVAILABLE'];
const weaker = (a: Provenance, b: Provenance) => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

export function mergeBomBySku(
  items: readonly BomItem[],
  locale: Locale = DEFAULT_LOCALE,
): readonly BomItem[] {
  const out: BomItem[] = [];
  const indexByKey = new Map<string, number>();
  // Peran dan panjang bersih tiap baris pipa yang digabung, untuk dibulatkan sekali di akhir.
  const parts = new Map<number, { purpose: string; netM: number }[]>();
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
      if (item.rod !== undefined && item.netLengthM !== undefined) {
        parts.set(out.length, [{ purpose: item.purpose ?? item.item, netM: item.netLengthM }]);
      }
      out.push(item);
      continue;
    }
    const prev = out[at]!;
    const pipeParts = parts.get(at);
    if (
      pipeParts !== undefined &&
      item.netLengthM !== undefined &&
      item.rod?.meters === prev.rod?.meters &&
      item.allowancePct === prev.allowancePct
    ) {
      pipeParts.push({ purpose: item.purpose ?? item.item, netM: item.netLengthM });
    } else {
      parts.delete(at);
    }
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
  for (const [at, pipe] of parts) {
    if (pipe.length < 2) continue;
    const row = out[at]!;
    const netM = Math.round(pipe.reduce((sum, p) => sum + p.netM, 0) * 100) / 100;
    const num = (n: number) =>
      n.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });
    const detail = pipe.map((p) => `${p.purpose.toLowerCase()} ${num(p.netM)} m`).join(' + ');
    const purchase = pipePurchase(
      netM,
      detail,
      {
        meters: row.rod!.meters,
        productName: row.rod!.productName,
        ...(row.productId !== undefined ? { productId: row.productId } : {}),
      },
      locale,
      row.allowancePct ?? 0,
    );
    out[at] = {
      ...row,
      netLengthM: netM,
      quantity: purchase.quantity,
      calc: purchase.calc,
      basis: purchase.basis,
    };
  }
  return out;
}

/** Dua peruntukan satu SKU ditulis berdampingan ("Pipa utama · Cabang"), tanpa pengulangan. */
function mergedPurpose(a: string | undefined, b: string | undefined): { purpose?: string } {
  const parts = [...new Set([...(a?.split(' · ') ?? []), ...(b?.split(' · ') ?? [])])];
  return parts.length > 0 ? { purpose: parts.join(' · ') } : {};
}
