/**
 * Jumlah beli pipa dari panjang bersih dan panjang batang produk katalog yang terpilih (audit C6).
 *
 * Sebelumnya tiga tampilan memakai konstanta 4 m untuk semua pipa, padahal katalog Pralon menjual
 * batang 4 m, 5,8 m, 6 m, dan gulungan HDPE/MDPE. Di sini panjang bersih (yang dihitung dari jalur)
 * dan jumlah beli (batang utuh) dipisah, dan alasan selisihnya ditulis di kolom dasar perhitungan.
 * Tidak ada tambahan potongan atau cadangan kecuali dikonfigurasi — tidak ada yang dikonfigurasi.
 */

import { specHasValue, type Locale, type Product } from '@snouty/shared-types';

export interface StockLength {
  readonly meters: number;
  /** Nama produk sumber panjangnya — supaya angka batang bisa dilacak ke katalog. */
  readonly productName: string;
}

/** Panjang di atas ini dijual per gulung; jumlahnya dinyatakan dalam meter, bukan batang. */
const COIL_FROM_M = 50;

/** "4 m", "5,8 m", "6 Meter" → meter. */
const LENGTH_VALUE = /(\d+(?:[.,]\d+)?)\s*(?:m|meter)\b/i;
/** Nama katalog "... x 5.8 Meter" — format nama produk Pralon, bukan pola pertanyaan pengguna. */
const LENGTH_IN_NAME = /x\s*(\d+(?:[.,]\d+)?)\s*Meter/i;

const toNumber = (text: string) => Number(text.replace(',', '.'));

/** Panjang batang produk: spesifikasi terverifikasi lebih dulu, lalu nama produk katalog. */
export function stockLengthOf(product: Product): StockLength | null {
  const fromSpec = specHasValue(product.rodLength)
    ? LENGTH_VALUE.exec(product.rodLength.value)
    : null;
  const match = fromSpec ?? LENGTH_IN_NAME.exec(product.name);
  if (!match) return null;
  const meters = toNumber(match[1]!);
  return meters > 0 ? { meters, productName: product.name } : null;
}

export interface PipePurchase {
  readonly quantity: number;
  readonly unit: 'batang' | 'meter';
  readonly basis: string;
}

const num = (n: number, locale: Locale) =>
  n.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });

/**
 * Jumlah beli untuk `netLengthM` meter jalur. `detail` menjelaskan dari mana panjang bersih itu
 * (mis. "4 riser × 90 m"). Tanpa panjang batang di katalog → meter, dengan alasan.
 */
export function pipePurchase(
  netLengthM: number,
  detail: string,
  stock: StockLength | null,
  locale: Locale,
): PipePurchase {
  const en = locale === 'en';
  const net = en
    ? `Net length ${num(netLengthM, locale)} m (${detail})`
    : `Panjang bersih ${num(netLengthM, locale)} m (${detail})`;
  if (stock === null) {
    return {
      quantity: Math.ceil(netLengthM),
      unit: 'meter',
      basis: en
        ? `${net}. The pipe length per piece is not in the catalogue for this product, so the quantity is in metres.`
        : `${net}. Panjang per batang produk ini belum tercatat di katalog, jadi jumlahnya dalam meter.`,
    };
  }
  if (stock.meters >= COIL_FROM_M) {
    return {
      quantity: Math.ceil(netLengthM),
      unit: 'meter',
      basis: en
        ? `${net}. ${stock.productName} is sold in ${num(stock.meters, locale)} m coils, so the quantity is in metres.`
        : `${net}. ${stock.productName} dijual per gulung ${num(stock.meters, locale)} m, jadi jumlahnya dalam meter.`,
    };
  }
  const exact = netLengthM / stock.meters;
  const rods = Math.ceil(exact);
  return {
    quantity: rods,
    unit: 'batang',
    basis: en
      ? `${net} ÷ ${num(stock.meters, locale)} m per piece (${stock.productName}) = ${num(exact, locale)} → ${rods} pieces, rounded up to whole pieces; no cutting allowance added.`
      : `${net} ÷ ${num(stock.meters, locale)} m per batang (${stock.productName}) = ${num(exact, locale)} → ${rods} batang, dibulatkan ke batang utuh; belum termasuk sisa potongan.`,
  };
}
