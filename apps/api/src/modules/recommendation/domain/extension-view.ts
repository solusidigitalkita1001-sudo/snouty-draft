/**
 * Perluasan rumah dengan titik air TAMBAHAN yang disebut ("rumah 2 lantai, 3 kamar mandi … mau tambah
 * 2 titik air") — keputusan pemilik 2026-10-19 (P25-06): rumah yang disebut adalah instalasi yang
 * sudah ada (beban lama), titik tambahan adalah beban baru. Daftar material hanya untuk titik baru;
 * pipa utama lama dicek terhadap beban total oleh `withRenovation` (ENG-904). **Fungsi murni.**
 *
 * Yang dihitung untuk titik baru: pipa ke alat (1,5 m per titik, `HOUSE_FIXTURE_DROP_1_5M`) dengan
 * sisa potong, elbow dan drat kran per titik. Cabang dari pipa lama ke titik baru bergantung letaknya
 * — ditampilkan sebagai baris yang menunggu jaraknya, bukan angka karangan.
 */
import { assumption, assumptionDescription } from '@snouty/engineering';
import type { Assumption, BomItem, Locale, Recommendation } from '@snouty/shared-types';
import { pipePurchase } from './pipe-quantity.js';

/** Panjang batang dari nama produk katalog ("... x 4 Meter") — format nama Pralon. */
const LENGTH_IN_NAME = /x\s*(\d+(?:[.,]\d+)?)\s*Meter/i;

export function extensionOnly(
  recommendation: Recommendation,
  added: number,
  existingOutlets: number,
  locale: Locale,
): Recommendation {
  const en = locale === 'en';
  const fixtureSize = recommendation.stats?.fixtureConnectionSize ?? '1/2"';
  const pipe =
    recommendation.products.find((p) => p.role === 'fixture') ??
    recommendation.products.find((p) => p.size === fixtureSize && p.role === 'branch');
  const pipeName = pipe?.name;
  const rodMatch = pipeName ? LENGTH_IN_NAME.exec(pipeName) : null;
  const stock =
    pipe && pipeName && rodMatch
      ? {
          meters: Number(rodMatch[1]!.replace(',', '.')),
          productId: pipe.productId,
          productName: pipeName,
        }
      : null;
  const dropM = Number(assumption('HOUSE_FIXTURE_DROP_1_5M').value);
  const allowance = Number(assumption('PIPE_CUTTING_ALLOWANCE_10PCT').value);
  const purchase = pipePurchase(
    added * dropM,
    en
      ? `${added} new points × ${dropM.toLocaleString('en-US')} m to the fixture`
      : `${added} titik baru × ${dropM.toLocaleString('id-ID')} m ke alat`,
    stock,
    locale,
    allowance,
  );
  const elbow = recommendation.bom.find((b) => b.size === fixtureSize && /^elbow$/i.test(b.item));
  const faucet = recommendation.bom.find((b) => b.size === fixtureSize && /faucet/i.test(b.item));
  const perPoint = (row: BomItem | undefined, item: string, purpose: string): BomItem[] =>
    row
      ? [
          {
            ...row,
            item,
            purpose,
            quantity: added,
            basis: en
              ? `1 per new water point: ${added} points = ${added} pcs.`
              : `1 per titik air baru: ${added} titik = ${added} pcs.`,
            traceIds: [],
          },
        ]
      : [];
  const bom: BomItem[] = [
    {
      item: en ? 'Pipe' : 'Pipa',
      purpose: en ? 'Pipe to the new points' : 'Pipa ke titik air baru',
      size: fixtureSize,
      quantity: purchase.quantity,
      unit: purchase.unit,
      basis: purchase.basis,
      calc: purchase.calc,
      ...(purchase.productId ? { productId: purchase.productId } : {}),
      provenance: 'ASSUMED',
      system: 'clean_water',
      traceIds: [],
    },
    ...perPoint(elbow, elbow?.item ?? 'Elbow', en ? 'Elbow to the fixture' : 'Elbow ke alat'),
    ...perPoint(faucet, faucet?.item ?? 'Faucet elbow', en ? 'Tap thread' : 'Drat kran'),
    {
      item: en ? 'Branch pipe' : 'Pipa cabang',
      purpose: en ? 'From the existing pipe to the new points' : 'Dari pipa lama ke titik baru',
      size: fixtureSize,
      quantity: 0,
      unit: 'batang',
      basis: en
        ? 'Depends on where the new points are; give their distance from the existing pipe to count it.'
        : 'Bergantung letak titik baru; sebutkan jaraknya dari pipa lama supaya bisa dihitung.',
      provenance: 'ASSUMED',
      system: 'clean_water',
      traceIds: [],
      pending: true,
    },
  ];
  const assumed = (id: string): Assumption => ({
    text: assumptionDescription(id, locale),
    fieldPath: '',
    assumptionId: id,
  });
  return {
    ...recommendation,
    headline: en
      ? `${added} new water points on a house with ${existingOutlets} existing points`
      : `${added} titik air baru di rumah dengan ${existingOutlets} titik air`,
    body: en
      ? `The house as described counts as the existing installation (${existingOutlets} water points); the ${added} added points are the new part, so the material list covers only them.`
      : `Rumah yang disebut dihitung sebagai instalasi yang sudah ada (${existingOutlets} titik air); ${added} titik tambahan adalah bagian baru, jadi daftar materialnya hanya untuk titik itu.`,
    bom,
    assumptions: [
      ...recommendation.assumptions,
      assumed('HOUSE_FIXTURE_DROP_1_5M'),
      assumed('PIPE_CUTTING_ALLOWANCE_10PCT'),
    ],
  };
}
