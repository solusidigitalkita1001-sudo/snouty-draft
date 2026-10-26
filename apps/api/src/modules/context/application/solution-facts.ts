/**
 * DATA solusi aktif untuk penulis balasan (P22-04): ukuran pipa, kebutuhan pompa, pilihan tinggi
 * toren, dan ringkasan BOQ — semuanya angka hasil engine yang tersimpan di rekomendasi. Model
 * merangkai kalimat; `ReplyWriter` menolak angka yang tidak ada di sini.
 */
import type { Locale, SolutionNeed, TankStandView } from '@snouty/shared-types';
import type { ActiveSolution } from '../domain/active-solution.port.js';

export function solutionFacts(solution: ActiveSolution | null | undefined, locale: Locale): string {
  if (!solution) return '';
  const en = locale === 'en';
  const r = solution.recommendation;
  const num = (n: number) => n.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });
  const lines: string[] = [];
  lines.push(en ? 'SOLUTION ALREADY CALCULATED:' : 'SOLUSI YANG SUDAH DIHITUNG:');
  if (solution.stale) {
    lines.push(
      en
        ? '- The requirement changed after this calculation; the user should press Compose recommendation again for current figures.'
        : '- Kebutuhan sudah berubah setelah hitungan ini; untuk angka terbaru pengguna perlu menekan Susun rekomendasi lagi.',
    );
  }
  lines.push(`- ${r.headline}`);
  for (const line of r.systemLines) {
    lines.push(`- ${line.name} (${line.path}): ${line.size}`);
  }
  for (const need of r.needs ?? []) lines.push(...needLines(need, locale, num));
  if (r.tankStand) lines.push(...tankStandLines(r.tankStand, locale, num));
  const boq = r.bom.filter((b) => b.quantity > 0);
  if (boq.length > 0) {
    lines.push(en ? 'MATERIAL LIST (BOQ):' : 'DAFTAR MATERIAL (BOQ):');
    for (const b of boq) {
      lines.push(`- ${b.purpose ?? b.item} ${b.size}: ${num(b.quantity)} ${b.unit}`);
    }
  }
  return lines.join('\n');
}

function needLines(need: SolutionNeed, locale: Locale, num: (n: number) => string): string[] {
  const en = locale === 'en';
  switch (need.kind) {
    case 'booster_pump':
      return [
        en
          ? `- Booster pump needed: only ${need.residualBar === undefined ? '?' : num(need.residualBar)} bar at the highest outlet without it${need.minimumStandM === undefined ? '' : `; or raise the tank stand to ${num(need.minimumStandM)} m above the roof`}.`
          : `- Perlu pompa pendorong: tanpa pompa hanya ${need.residualBar === undefined ? '?' : num(need.residualBar)} bar di titik air tertinggi${need.minimumStandM === undefined ? '' : `; atau dudukan toren dinaikkan ke ${num(need.minimumStandM)} m di atas atap`}.`,
      ];
    case 'drainage':
      return [
        en
          ? `- Drainage: soil ${need.soilSize ?? '?'}, waste ${need.wasteSize ?? '?'}, vents ${need.soilVentSize ?? '?'} / ${need.wasteVentSize ?? '?'}.`
          : `- Pembuangan: air kotor ${need.soilSize ?? '?'}, air bekas ${need.wasteSize ?? '?'}, ventilasi ${need.soilVentSize ?? '?'} / ${need.wasteVentSize ?? '?'}.`,
      ];
    case 'well_pump':
      return need.wellDepthM === undefined
        ? []
        : [
            en
              ? `- Well water level ${num(need.wellDepthM)} m${need.deepWell ? ' (beyond a surface pump: jet or submersible pump)' : ''}.`
              : `- Muka air sumur ${num(need.wellDepthM)} m${need.deepWell ? ' (di luar batas pompa sedot biasa: pompa jet atau submersible)' : ''}.`,
          ];
    default:
      return [];
  }
}

function tankStandLines(view: TankStandView, locale: Locale, num: (n: number) => string): string[] {
  const en = locale === 'en';
  const label = (o: TankStandView['options'][number]) =>
    o.kind === 'roof_slab'
      ? en
        ? 'on the roof slab'
        : 'di dak atap'
      : en
        ? `${num(o.supportHeightM)} m tank tower`
        : `tiang toren ${num(o.supportHeightM)} m`;
  const status = (o: TankStandView['options'][number]) =>
    o.comfortable
      ? en
        ? 'strong shower'
        : 'deras di shower'
      : o.meetsMinimum
        ? en
          ? 'enough without a pump'
          : 'cukup tanpa pompa'
        : en
          ? 'not enough, needs a pump'
          : 'kurang, perlu pompa';
  const lines = [
    en
      ? `TANK HEIGHT OPTIONS (gravity only, minimum ${num(view.minimumBar)} bar, strong shower from ${num(view.comfortBar)} bar); pipe from the tank ${view.mainSize}, branches inside ${view.branchSizes.join(' / ')}:`
      : `PILIHAN TINGGI TOREN (gravitasi saja, minimum ${num(view.minimumBar)} bar, deras di shower mulai ${num(view.comfortBar)} bar); pipa dari toren ${view.mainSize}, cabang di dalam rumah ${view.branchSizes.join(' / ')}:`,
  ];
  view.options.forEach((o, i) => {
    lines.push(
      `- ${label(o)}, ${en ? 'water level' : 'muka air'} ${num(o.waterLevelM)} m: ${num(o.residualBar)} bar, ${status(o)}${i === view.recommendedIndex ? (en ? ' (lowest that is enough)' : ' (terendah yang cukup)') : ''}`,
    );
  });
  if (view.recommendedIndex === null) {
    lines.push(
      en
        ? '- None of these supports is enough without a booster pump.'
        : '- Tidak ada dudukan di daftar ini yang cukup tanpa pompa pendorong.',
    );
  }
  return lines;
}

/**
 * Jawaban tetap untuk pertanyaan bentuk sistem (P22-02) — jalur per segmen dan materialnya dari
 * rekomendasi, tanpa model. Dipakai sebagai teks bila model tidak dikonfigurasi atau ditolak pagar.
 */
/** Satuan yang menandai baris PIPA di daftar belanja, dua bahasa (P31-37). */
const PIPE_UNITS = new Set(['batang', 'rods', 'meter', 'm']);

export function layoutReply(solution: ActiveSolution, locale: Locale): string {
  const en = locale === 'en';
  const r = solution.recommendation;
  const num = (n: number) => n.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });
  const lines = r.systemLines.map(
    (l) => `${l.name.toLowerCase()} ${l.size} (${l.path.toLowerCase()})`,
  );
  const rows = r.bom.filter((b) => b.quantity > 0);
  // Satuan BOM solusi Inggris sudah diterjemahkan ("rods"), dan peruntukannya pun ("Main line"),
  // jadi baris pipa tidak dikenali dari kata "pipa" maupun satuan "batang": daftar belanja Inggris
  // menaruh batang pipa di bawah "Fittings", lalu kalimat "jumlah batangnya belum dihitung" ikut
  // muncul walau batangnya ada di baris yang sama (produksi 2026-10-26).
  const pipes = rows.filter(
    (b) => /^pipa|^pipe/i.test(b.purpose ?? b.item) || PIPE_UNITS.has(b.unit),
  );
  const fittings = rows.filter((b) => !pipes.includes(b));
  const list = (items: typeof rows) =>
    items
      .map((b) => `${(b.purpose ?? b.item).toLowerCase()} ${b.size} ${num(b.quantity)} ${b.unit}`)
      .join(', ');
  const stale = solution.stale
    ? en
      ? ' The requirement changed after this calculation; press Compose recommendation again for current figures.'
      : ' Kebutuhan sudah berubah setelah hitungan ini; tekan Susun rekomendasi lagi untuk angka terbaru.'
    : '';
  // Jumlah batang pipa hanya dihitung bila ukuran bangunannya disebut (PIPE_RUN_DEFAULT_20M:
  // jalur 20 m hanya untuk memilih UKURAN, tidak untuk jumlah batang). Tanpa itu daftar belanja
  // berisi fitting saja — dan "berapa batang pipanya" dijawab daftar fitting tanpa sepatah kata
  // tentang pipanya (produksi 2026-10-26).
  const noPipeCount =
    pipes.length === 0
      ? en
        ? ' The number of pipe lengths is not counted yet — that needs the size of the building (length × width); the size of each run is above.'
        : ' Jumlah batang pipanya belum dihitung — itu perlu ukuran bangunannya (panjang × lebar); ukuran tiap jalurnya ada di atas.'
      : '';
  if (en) {
    return (
      `The installation section is below. The runs: ${lines.join('; ')}.` +
      (pipes.length > 0 ? ` Pipes: ${list(pipes)}.` : '') +
      (fittings.length > 0 ? ` Fittings: ${list(fittings)}.` : '') +
      noPipeCount +
      stale
    );
  }
  return (
    `Potongan instalasinya di bawah. Jalurnya: ${lines.join('; ')}.` +
    (pipes.length > 0 ? ` Pipa: ${list(pipes)}.` : '') +
    (fittings.length > 0 ? ` Fitting: ${list(fittings)}.` : '') +
    noPipeCount +
    stale
  );
}

/**
 * Jawaban untuk "butuh berapa batang pipa": baris PIPA saja. Daftar belanja penuh (jalur, pipa,
 * dan belasan baris fitting) adalah satu paragraf raksasa untuk pertanyaan sependek itu — layar
 * solusi yang memuat daftar lengkapnya (produksi 2026-10-26).
 */
/**
 * Jalur-jalur di solusi pengguna, satu kalimat. Dipakai untuk pertanyaan yang tidak tercakup data
 * pengetahuan tetapi SUDAH terjawab solusinya: "air bekas cucian masuk ke mana" dijawab "belum
 * punya acuan" di produksi 2026-10-26, padahal baris air bekas solusinya menyebut tujuannya.
 */
/** Baris jalur buangan: air kotor, air bekas, dan ventilasinya. */
const DRAINAGE_LINE = /kotor|bekas|ventilasi|buang|soil|waste|vent|drain/i;

export function runsReply(
  solution: ActiveSolution,
  locale: Locale,
  /** Pertanyaannya tentang pembuangan: jalur air bersih tidak ikut dibacakan. */
  drainageOnly = false,
): string | null {
  const all = solution.recommendation.systemLines;
  const chosen = drainageOnly ? all.filter((l) => DRAINAGE_LINE.test(`${l.name} ${l.path}`)) : all;
  const lines = (chosen.length > 0 ? chosen : all).map(
    (l) => `${l.name.toLowerCase()} ${l.size} (${l.path.toLowerCase()})`,
  );
  if (lines.length === 0) return null;
  return locale === 'en'
    ? `The runs in your solution: ${lines.join('; ')}. The basis of every figure is under "Show technical details" on the solution screen.`
    : `Jalur di solusi Anda: ${lines.join('; ')}. Dasar tiap angka ada di "Tampilkan detail teknis" pada layar solusi.`;
}

export function rodsReply(solution: ActiveSolution, locale: Locale): string | null {
  const en = locale === 'en';
  const r = solution.recommendation;
  const num = (n: number) => n.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });
  const pipes = r.bom.filter(
    (b) => b.quantity > 0 && (/^pipa|^pipe/i.test(b.purpose ?? b.item) || PIPE_UNITS.has(b.unit)),
  );
  if (pipes.length === 0) return null;
  const list = pipes
    .map((b) => `${(b.purpose ?? b.item).toLowerCase()} ${b.size} ${num(b.quantity)} ${b.unit}`)
    .join(', ');
  return en
    ? `Pipes: ${list}. The full product list, with fittings, is on the solution screen.`
    : `Pipanya: ${list}. Daftar lengkapnya, fitting dan semuanya, ada di layar solusi.`;
}

/**
 * Jawaban tetap untuk pertanyaan tentang solusi yang sudah dihitung (P22-04): judul solusi, jalur
 * utama, pompa/tinggi toren bila ada — dari rekomendasi, tanpa model. Dipakai bila model tidak
 * dikonfigurasi, lambat, atau ditolak pagar; dulu teks generik "buka detail teknis".
 */
/**
 * "itung" pada kasus yang solusinya SUDAH dihitung dan masih sesuai: satu baris yang menyebut
 * hasilnya dan di mana angkanya, bukan seluruh solusinya dituang ulang — yang membuat
 * pertanyaan berikutnya ("pipa buangannya ukuran berapa") terbaca sebagai ulangan dan dijawab
 * "itu yang saya jelaskan di jawaban sebelumnya" (produksi 2026-10-26).
 */
export function alreadyComputedReply(solution: ActiveSolution, locale: Locale): string {
  const headline = solution.recommendation.headline.replace(/\.$/, '');
  return locale === 'en'
    ? `Already worked out — ${headline}. The sizes, lengths and product list are on the solution screen.`
    : `Sudah saya hitung — ${headline}. Ukuran, jumlah batang, dan daftar produknya ada di layar solusi.`;
}

export function solutionReply(solution: ActiveSolution, locale: Locale): string {
  const en = locale === 'en';
  const r = solution.recommendation;
  const num = (n: number) => n.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });
  const parts: string[] = [r.headline.replace(/\.$/, '') + '.'];
  const main = r.systemLines.find((l) => l.role === 'main');
  if (main) {
    parts.push(
      en
        ? `${main.name} ${main.size} (${main.path.toLowerCase()}).`
        : `${main.name} ${main.size} (${main.path.toLowerCase()}).`,
    );
  }
  const booster = (r.needs ?? []).find((n) => n.kind === 'booster_pump');
  const stand = r.tankStand;
  if (stand) {
    const rec = stand.recommendedIndex === null ? null : stand.options[stand.recommendedIndex];
    const label = (o: NonNullable<typeof rec>) =>
      o.kind === 'roof_slab'
        ? en
          ? 'on the roof slab'
          : 'di dak atap'
        : en
          ? `a ${num(o.supportHeightM)} m tank tower`
          : `tiang toren ${num(o.supportHeightM)} m`;
    const roof = stand.options[0];
    parts.push(
      rec
        ? en
          ? `Without a booster pump the lowest support that still gives ${num(stand.minimumBar)} bar at the highest outlet is ${label(rec)} (water level ${num(rec.waterLevelM)} m, ${num(rec.residualBar)} bar)${roof && roof !== rec ? `; ${label(roof)} gives only ${num(roof.residualBar)} bar` : ''}.`
          : `Tanpa pompa pendorong, dudukan terendah yang masih memberi ${num(stand.minimumBar)} bar di titik air tertinggi adalah ${label(rec)} (muka air ${num(rec.waterLevelM)} m, ${num(rec.residualBar)} bar)${roof && roof !== rec ? `; ${label(roof)} hanya memberi ${num(roof.residualBar)} bar` : ''}.`
        : en
          ? `None of the tank supports reaches ${num(stand.minimumBar)} bar without a booster pump.`
          : `Tidak ada dudukan toren yang mencapai ${num(stand.minimumBar)} bar tanpa pompa pendorong.`,
    );
    parts.push(
      en
        ? `Pipe from the tank ${stand.mainSize}, branches inside ${stand.branchSizes.join(' / ')}.`
        : `Pipa dari toren ${stand.mainSize}, cabang di dalam rumah ${stand.branchSizes.join(' / ')}.`,
    );
  } else if (booster) {
    parts.push(
      en
        ? `A booster pump is needed${booster.residualBar === undefined ? '' : `: only ${num(booster.residualBar)} bar at the highest outlet without it`}.`
        : `Perlu pompa pendorong${booster.residualBar === undefined ? '' : `: tanpa pompa hanya ${num(booster.residualBar)} bar di titik air tertinggi`}.`,
    );
  }
  // Solusi yang juga menghitung pembuangan menyebut ukuran jalurnya: di produksi 2026-10-26
  // "pipa buangannya ukuran berapa" dijawab ukuran pipa AIR BERSIH saja, padahal jalur air kotor,
  // air bekas, dan ventilasinya sudah dihitung.
  const drainage = (r.needs ?? []).find((n) => n.kind === 'drainage');
  if (drainage) {
    const lines = [
      drainage.soilSize === undefined
        ? null
        : `${en ? 'soil line' : 'air kotor'} ${drainage.soilSize}`,
      drainage.wasteSize === undefined
        ? null
        : `${en ? 'waste line' : 'air bekas'} ${drainage.wasteSize}`,
      drainage.soilVentSize === undefined
        ? null
        : `${en ? 'soil vent' : 'ventilasi air kotor'} ${drainage.soilVentSize}`,
      drainage.wasteVentSize === undefined
        ? null
        : `${en ? 'waste vent' : 'ventilasi air bekas'} ${drainage.wasteVentSize}`,
    ]
      .filter((line): line is string => line !== null)
      // Judul solusi pembuangan sudah menyebut air kotor dan air bekasnya; yang diulang kata
      // demi kata dalam satu balasan terbaca seperti mesin (produksi 2026-10-26).
      .filter((line) => !r.headline.includes(line));
    if (lines.length > 0) {
      parts.push(`${en ? 'Drainage' : 'Pembuangan'}: ${lines.join(', ')}.`);
    }
  }
  parts.push(
    solution.stale
      ? en
        ? 'The requirement changed after this calculation; press Compose recommendation again for current figures.'
        : 'Kebutuhan sudah berubah setelah hitungan ini; tekan Susun rekomendasi lagi untuk angka terbaru.'
      : en
        ? 'The basis of every figure is under "Show technical details" on the solution screen.'
        : 'Dasar tiap angka ada di "Tampilkan detail teknis" pada layar solusi.',
  );
  return parts.join(' ');
}
