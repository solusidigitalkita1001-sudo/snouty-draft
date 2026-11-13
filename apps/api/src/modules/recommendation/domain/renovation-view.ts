/**
 * Lapisan renovasi di atas rekomendasi kasus mana pun (P23-02, pemilik 2026-10-19: "inget dari
 * semua case"). Kasusnya sudah mengukur pipa untuk bagian yang dikerjakan; lapisan ini menambahkan
 * yang hanya ada pada instalasi yang sudah terpasang — dari engine (`computeRenovation`), bukan
 * dari prosa:
 *
 *   - judul dan kalimat pembuka menyebut jenis pekerjaannya;
 *   - baris sistem: pipa lama cukup/kurang (ENG-901), sambungan ke pipa lama (ENG-902), segmen
 *     yang diganti (ENG-903);
 *   - BOM: perluasan → fitting sambungan (tee, sok drat); ganti sebagian → pipa hanya sepanjang
 *     segmen + sok penyambung;
 *   - asumsi renovasi di tabel asumsi; kapasitas yang tidak bisa dicek DITULIS, bukan diam.
 *
 * Fakta renovasi dibaca dari parameter kasus teknis (`work_type`, `existing_*`, `replacement_length`)
 * atau field rumah (`water.workType`, …) — satu pembaca untuk keduanya.
 */
import {
  computeRenovation,
  renovationModeOf,
  WORK_TYPE_MODE,
  applyAssumption,
  assumptionDescription,
  type RenovationMode,
  type RenovationResult,
  type TieInFittingKind,
} from '@snouty/engineering';
import {
  DEFAULT_LOCALE,
  type Assumption,
  type BomItem,
  type ExistingPipeCheck,
  type KeyValue,
  type Locale,
  type Recommendation,
  type RequirementState,
  type SystemLine,
  type WorkType,
} from '@snouty/shared-types';
import { ulid } from '../../../shared/ulid.js';
import { bomUnitLabel, provenanceFor, type IdentifiedTrace } from './solution-view.js';

export interface RenovationFacts {
  readonly mode: Exclude<RenovationMode, 'new'>;
  readonly existingSize: string | null;
  /** Label registry (`PVC`, `Galvanis / besi`, …) atau `null`. */
  readonly existingMaterial: string | null;
  readonly existingLoad: number | null;
  readonly replacementLengthM: number | null;
}

/** Field rumah → mode engine; `renovation` (belum jelas) dihitung seperti bangun baru, ditandai di chat. */
const HOUSE_MODE: Readonly<Record<WorkType, RenovationMode>> = {
  new: 'new',
  replace_all: 'replace_all',
  replace_partial: 'replace_partial',
  extend: 'extend',
  renovation: 'new',
};
const HOUSE_MATERIAL: Readonly<Record<string, string>> = {
  pvc: 'PVC',
  galvanized: 'Galvanis / besi',
  hdpe: 'HDPE',
  ppr: 'PPR',
};

/**
 * Keluarga pipa untuk sambungan ke pipa LAMA, dari bahannya. HDPE punya keluarganya sendiri;
 * PVC lama disambung dengan keluarga pipa baru yang dipakai kasus ini. Galvanis, PPR, dan bahan
 * yang tidak disebut tidak punya keluarga Pralon — penyambungnya bukan produk katalog, jadi
 * `null` supaya barisnya tampil sebagai produk setara, bukan sok PVC AW (smoke test 13 Nov 2026).
 */
export function existingPipeFamilyOf(
  existingMaterial: string | null,
  fallbackFamily: string,
): string | null {
  switch (existingMaterial) {
    case 'HDPE':
      return 'HDPE';
    case 'PVC':
      return fallbackFamily;
    default:
      return null;
  }
}

/** Fakta renovasi dari state; `null` = bangun baru (tidak ada lapisan renovasi). */
export function renovationFactsFrom(state: RequirementState): RenovationFacts | null {
  if (state.useCase?.kind === 'technical') {
    const p = state.useCase.parameters;
    const mode = renovationModeOf(p['work_type']?.value);
    if (mode === 'new') return null;
    const text = (key: string): string | null => {
      const v = p[key]?.value;
      return typeof v === 'string' && v !== 'Belum tahu' ? v : null;
    };
    const num = (key: string): number | null => {
      const v = p[key]?.value;
      return typeof v === 'number' ? v : null;
    };
    return {
      mode,
      existingSize: text('existing_pipe_size'),
      existingMaterial: text('existing_pipe_material'),
      existingLoad: num('existing_outlets') ?? num('existing_connections'),
      replacementLengthM: num('replacement_length'),
    };
  }
  if (state.useCase !== undefined) return null;
  const workType = state.water.workType?.value ?? null;
  const mode: RenovationMode =
    workType !== null
      ? (HOUSE_MODE[workType] ?? 'new')
      : state.water.replaceExisting?.value === true
        ? 'replace_all'
        : 'new';
  if (mode === 'new') return null;
  const material = state.water.existingPipeMaterial?.value ?? null;
  // `unknown` adalah jawaban: pengguna sudah ditanya dan tidak tahu. Nilainya tetap "belum ada"
  // bagi hitungan, jadi kapasitas pipa lama disebut belum dicek alih-alih dibandingkan dengan
  // label yang tidak punya diameter.
  const size = state.water.existingMainSize?.value ?? null;
  return {
    mode,
    existingSize: size === 'unknown' ? null : size,
    existingMaterial: material === null ? null : (HOUSE_MATERIAL[material] ?? null),
    existingLoad: state.water.existingOutlets?.value ?? null,
    replacementLengthM: state.water.replacementLengthM?.value ?? null,
  };
}

export interface RenovationContext {
  /** Ukuran pipa utama/induk yang dihitung kasus untuk bagian yang dikerjakan. */
  readonly newMainSize: string;
  /** Cabang baru yang disambung ke pipa lama (perluasan); kosong = pipa utama baru. */
  readonly branchSize?: string | null;
  /** Beban bagian baru dalam satuan profil (titik air / sambungan). */
  readonly newLoad?: number | null;
  readonly loadUnit?: 'titik' | 'sambungan';
  readonly routeLengthM?: number | null;
  /**
   * Ukuran yang dibutuhkan beban total menurut aturan kasusnya — dihitung ulang oleh pemanggil
   * dengan beban lama + baru; `null` = kasus ini tidak bisa menghitungnya (disebut di solusi).
   */
  readonly sizeForTotal?: ((existingLoad: number, totalLoad: number) => string | null) | null;
  /** ID asumsi tambahan yang dipakai pemanggil saat menghitung beban total (mis. 1 WSFU/titik). */
  readonly extraAssumptionIds?: readonly string[];
  /** Keluarga pipa untuk nama baris BOM fitting sambungan. */
  readonly family: string;
  /**
   * Keluarga pipa LAMA, dari bahannya — penyambung ujung segmen yang diganti memakai nama ini,
   * bukan keluarga pipa baru: potongan pada pipa HDPE tidak disambung dengan sok PVC AW
   * (smoke test 13 Nov 2026). Kosong = bahan lama tidak diketahui, pakai keluarga baru.
   */
  readonly existingFamily?: string | null;
  /**
   * Bagian BOQ untuk baris penyambung. Kosong = air bersih. Pekerjaan pembuangan tidak boleh
   * menghasilkan baris air bersih (smoke test 13 Nov 2026, temuan 2).
   */
  readonly system?: BomItem['system'];
  /** Produk katalog untuk fitting sambungan; `undefined` = tidak ada di katalog. */
  readonly productFor?: (
    kind: TieInFittingKind | 'socket' | 'pipe',
    size: string,
    branchSize?: string,
  ) => string | undefined;
}

export interface RenovatedRecommendation {
  readonly recommendation: Recommendation;
  readonly traces: readonly IdentifiedTrace[];
  readonly result: RenovationResult;
}

/** Nama jenis pekerjaan untuk judul/pembuka. */
export function workTypeLabel(mode: Exclude<RenovationMode, 'new'>, locale: Locale): string {
  const en = locale === 'en';
  switch (mode) {
    case 'extend':
      return en ? 'Extension' : 'Perluasan';
    case 'replace_partial':
      return en ? 'Partial replacement' : 'Penggantian sebagian';
    default:
      return en ? 'Pipe replacement' : 'Penggantian pipa';
  }
}

/** Nilai protokol `work_type` dari mode — untuk tampilan yang memakai label registry. */
export function workTypeProtocolOf(mode: RenovationMode): string {
  return Object.entries(WORK_TYPE_MODE).find(([, m]) => m === mode)?.[0] ?? 'Bangun baru';
}

/**
 * Nama baris penyambung menurut jenisnya (ENG-902). Kopling transisi PE tidak menyebut keluarga
 * Pralon mana pun: ia memang bukan produk katalog, dan menuliskan "Sok PVC AW" di sana adalah
 * yang membuat gambar kerja menyuruh menyambung HDPE dengan lem (smoke test 13 Nov 2026).
 */
function jointNameOf(kind: TieInFittingKind, family: string, locale: Locale): string {
  const en = locale === 'en';
  switch (kind) {
    case 'transition_coupling':
      return en
        ? 'Transition/compression coupling (rejoin to the existing pipe)'
        : 'Kopling transisi / kompresi (sambung ke pipa lama)';
    case 'faucet_socket':
      return en
        ? `Threaded socket ${family} (rejoin to the existing pipe)`
        : `Sok drat ${family} (sambung ke pipa lama)`;
    case 'tee':
      return en ? `Tee ${family} (tie-in)` : `Tee ${family} (titik sambung)`;
    case 'reducer':
      return en ? `Reducer ${family}` : `Reducer ${family}`;
    default:
      return en
        ? `Socket ${family} (rejoin to the existing pipe)`
        : `Sok ${family} (sambung ke pipa lama)`;
  }
}

/**
 * Baris tanpa SKU katalog. `exactOptionalPropertyTypes` tidak menerima `productId: undefined`,
 * jadi kuncinya dibuang, bukan dikosongkan.
 */
function withoutProductId({ productId: _productId, ...rest }: BomItem): Omit<BomItem, 'productId'> {
  return rest;
}
const isPipeRow = (row: BomItem): boolean =>
  row.unit === 'batang' ||
  row.unit === 'meter' ||
  row.unit === ('rods' as BomItem['unit']) ||
  row.unit === ('metres' as BomItem['unit']);

export function withRenovation(
  recommendation: Recommendation,
  facts: RenovationFacts,
  traces: readonly IdentifiedTrace[],
  ctx: RenovationContext,
  locale: Locale = DEFAULT_LOCALE,
  overrides: Readonly<Record<string, number>> = {},
): RenovatedRecommendation {
  const en = locale === 'en';
  const newLoad = ctx.newLoad ?? null;
  const totalLoad =
    facts.mode === 'extend' && facts.existingLoad !== null && newLoad !== null
      ? facts.existingLoad + newLoad
      : null;
  const requiredSizeForTotal =
    totalLoad !== null && ctx.sizeForTotal
      ? ctx.sizeForTotal(facts.existingLoad!, totalLoad)
      : null;
  const result = computeRenovation(
    {
      mode: facts.mode,
      newMainSize: ctx.newMainSize,
      branchSize: ctx.branchSize ?? null,
      existingSize: facts.existingSize,
      existingMaterial: facts.existingMaterial,
      requiredSizeForTotal,
      existingLoad: facts.existingLoad,
      newLoad,
      loadUnit: ctx.loadUnit ?? 'titik',
      replacementLengthM: facts.replacementLengthM,
      routeLengthM: ctx.routeLengthM ?? null,
    },
    locale,
    overrides,
  );
  const renovationTraces: IdentifiedTrace[] = result.traces.map((t) => ({ ...t, id: ulid() }));
  const allTraces = [...traces, ...renovationTraces];
  const idsOf = (ruleId: string) =>
    renovationTraces.filter((t) => t.ruleId === ruleId).map((t) => t.id);
  const explain = (ruleId: string) =>
    renovationTraces.find((t) => t.ruleId === ruleId)?.explanation ?? '';

  const label = workTypeLabel(facts.mode, locale);
  // Pipa lama sebagai DATA, bukan hanya prosa baris sistem: pertanyaan "pipa lama saya masih bisa
  // dipakai?" dijawab dari sini (P32-52).
  let existingPipe: ExistingPipeCheck = {
    mode: facts.mode,
    size: facts.existingSize,
    sufficient: null,
  };
  const systemLines: SystemLine[] = [];
  const highlights: KeyValue[] = [{ label: en ? 'Work' : 'Pekerjaan', value: label }];
  let bom: BomItem[] = [...recommendation.bom];
  const assumptions: Assumption[] = [...recommendation.assumptions];
  const sentences: string[] = [];

  if (facts.mode === 'extend') {
    if (result.capacity) {
      const c = result.capacity;
      const verdict = c.sufficient
        ? en
          ? `still sufficient for ${c.requiredSize}`
          : `masih cukup (butuh ${c.requiredSize})`
        : en
          ? `too small — replace with ${c.requiredSize}`
          : `kurang — ganti ke ${c.requiredSize}`;
      highlights.push({
        label: en ? 'Existing pipe' : 'Pipa lama',
        value: `${c.existingSize} · ${verdict}`,
      });
      existingPipe = {
        mode: facts.mode,
        size: c.existingSize,
        sufficient: c.sufficient,
        requiredSize: c.requiredSize,
      };
      systemLines.push({
        name: en ? 'Existing main pipe' : 'Pipa utama lama',
        path: en ? 'Source → tie-in' : 'Sumber → titik sambung',
        size: c.existingSize,
        reason: `${explain('ENG-904')} ${explain('ENG-901')}`.trim(),
        provenance: provenanceFor(allTraces, [...idsOf('ENG-904'), ...idsOf('ENG-901')]),
        traceIds: [...idsOf('ENG-904'), ...idsOf('ENG-901')],
        role: 'main',
      });
      sentences.push(
        c.sufficient
          ? en
            ? `${label}: the existing ${c.existingSize} main stays — it still carries the ${result.totalLoad} ${ctx.loadUnit === 'sambungan' ? 'connections' : 'water points'} after the extension.`
            : `${label}: pipa utama lama ${c.existingSize} tetap dipakai — masih cukup untuk ${result.totalLoad} ${ctx.loadUnit === 'sambungan' ? 'sambungan' : 'titik air'} setelah perluasan.`
          : en
            ? `${label}: the existing ${c.existingSize} main is too small for ${result.totalLoad} ${ctx.loadUnit === 'sambungan' ? 'connections' : 'water points'} in total and is replaced with ${c.requiredSize}; its length is not known yet, so it is not in the material list.`
            : `${label}: pipa utama lama ${c.existingSize} kurang untuk total ${result.totalLoad} ${ctx.loadUnit === 'sambungan' ? 'sambungan' : 'titik air'} dan diganti ke ${c.requiredSize}; panjangnya belum diketahui, jadi belum masuk daftar material.`,
      );
    } else {
      const reason =
        result.capacityUnchecked === 'no_existing_size'
          ? en
            ? 'the size of the existing pipe was not given'
            : 'ukuran pipa lama belum disebut'
          : result.capacityUnchecked === 'no_total_size'
            ? en
              ? 'the load already served was not given'
              : 'beban yang sudah dilayani pipa lama belum disebut'
            : en
              ? 'the existing size could not be compared'
              : 'ukuran pipa lama tidak bisa dibandingkan';
      highlights.push({
        label: en ? 'Existing pipe' : 'Pipa lama',
        value: en ? `not checked — ${reason}` : `belum dicek — ${reason}`,
      });
      existingPipe = {
        mode: facts.mode,
        size: facts.existingSize,
        sufficient: null,
        uncheckedReason: reason,
      };
      sentences.push(
        en
          ? `${label}: the new part is sized on its own; whether the existing main still copes was not checked because ${reason}.`
          : `${label}: bagian baru dihitung sendiri; pipa utama lama belum dicek cukup atau tidak karena ${reason}.`,
      );
      assumptions.push({
        text: en
          ? `The existing main pipe was not checked against the total load (${reason}); confirm it on site or give the missing figure.`
          : `Pipa utama lama belum dicek terhadap beban total (${reason}); pastikan di lapangan atau lengkapi datanya.`,
        fieldPath: '',
        ruleId: 'ENG-901',
      });
    }
    if (result.tieIn) {
      const t = result.tieIn;
      const method =
        t.method === 'threaded_adaptor'
          ? en
            ? 'threaded sockets + tee'
            : 'sok drat + tee'
          : t.method === 'specialist'
            ? en
              ? 'PPR fusion fittings (technical team)'
              : 'fitting fusi PPR (tim teknis)'
            : en
              ? 'tee'
              : 'tee';
      highlights.push({ label: en ? 'Tie-in' : 'Sambungan ke pipa lama', value: method });
      systemLines.push({
        name: en ? 'Tie-in to the existing pipe' : 'Sambungan ke pipa lama',
        path: `${t.existingSize} → ${t.branchSize}`,
        size: t.branchSize,
        reason: explain('ENG-902'),
        provenance: provenanceFor(allTraces, idsOf('ENG-902')),
        traceIds: idsOf('ENG-902'),
        role: 'fitting',
      });
      for (const f of t.fittings) {
        const name =
          f.kind === 'faucet_socket'
            ? en
              ? `Threaded socket ${ctx.family} (tie-in)`
              : `Sok drat ${ctx.family} (sambung pipa lama)`
            : f.kind === 'reducer'
              ? en
                ? `Reducer ${ctx.family} (tie-in)`
                : `Reducer ${ctx.family} (sambung pipa lama)`
              : en
                ? `Tee ${ctx.family} (tie-in)`
                : `Tee ${ctx.family} (sambung pipa lama)`;
        const productId = ctx.productFor?.(f.kind, f.size, f.branchSize);
        bom.push({
          item: name,
          system: ctx.system ?? 'clean_water',
          size: f.branchSize ? `${f.size} × ${f.branchSize}` : f.size,
          quantity: f.quantity,
          unit: bomUnitLabel('pcs', locale),
          basis: explain('ENG-902'),
          provenance: provenanceFor(allTraces, idsOf('ENG-902')),
          traceIds: idsOf('ENG-902'),
          ...(productId ? { productId } : {}),
        });
      }
      if (t.materialAssumed) {
        assumptions.push({
          text: en
            ? 'The existing pipe material was not given; the tie-in is drawn as a solvent-cemented tee and must be confirmed on site.'
            : 'Bahan pipa lama belum disebut; sambungannya dihitung sebagai tee lem dan harus dipastikan di lapangan.',
          fieldPath: 'existing_pipe_material',
          ruleId: 'ENG-902',
        });
      }
    }
  }

  if (facts.mode === 'replace_partial') {
    if (result.partial) {
      const p = result.partial;
      // Material segmen saja: pipa jalur utama sepanjang segmen + penyambung di kedua ujungnya.
      // Cabang, sambungan alat, dan fitting per titik air tidak diganti; baris tertunda
      // ("dihitung saat pemasangan") tetap, kecuali penyambung yang kini dihitung.
      //
      // Ukuran segmen = ukuran pipa LAMA (ENG-903 `segmentSize`). Segmen ini disambung ke pipa
      // lama di kedua ujungnya, jadi ukuran lain di tengah jalur yang sama bukan pekerjaan yang
      // bisa dipasang: smoke test 13 Nov 2026 menemukan potongan pada pipa HDPE 25 mm dijawab
      // "1 inci" beserta "Sok PVC AW 1 inci", sementara tabel kebutuhan di PDF yang sama menulis
      // "Ukuran pipa lama 25 mm · Bahan HDPE".
      const segmentSize = p.segmentSize ?? ctx.newMainSize;
      // Penyambung ujung dari ENG-902 (`rejoin`): sok lem untuk PVC, sok drat untuk galvanis,
      // kopling transisi untuk HDPE. Tanpa fitting (PPR) hanya kalimat aturannya yang tampil.
      const joints = result.tieIn?.fittings ?? [];
      const productId = ctx.productFor?.('socket', segmentSize);
      // Baris pipa yang DIGANTI: pekerjaan pembuangan memotong jalur air kotor atau air bekas,
      // jadi barisnya dicari di bagian itu. Sebelum temuan 2 smoke test 13 Nov 2026 jalur
      // pembuangan tidak punya baris "pipa utama" sama sekali, jadi seluruh material pipanya
      // hilang dan yang tersisa hanya sok kelas AW — barang air bersih untuk air kotor.
      const inSystem = (row: BomItem): boolean =>
        ctx.system === undefined || row.system === ctx.system;
      const firstPipe = bom.findIndex((row) => isPipeRow(row) && inSystem(row));
      const isMainPipe = (row: BomItem, index: number): boolean =>
        isPipeRow(row) &&
        inSystem(row) &&
        (ctx.system !== undefined || row.purpose === undefined
          ? index === firstPipe
          : /^(Pipa utama|Main line)$/.test(row.purpose));
      bom = bom.flatMap((row, index) => {
        if (isMainPipe(row, index)) {
          const quantity = p.ratio >= 1 ? row.quantity : Math.ceil(row.quantity * p.ratio);
          // Segmen berukuran pipa lama: produk hitungan (ukuran baru) tidak boleh ikut, karena
          // SKU-nya ukuran lain. Barisnya tinggal tanpa SKU → "pakai produk setara" di BOQ.
          const resized = p.segmentSize !== null && p.segmentSize !== row.size;
          const segmentProduct = resized ? ctx.productFor?.('pipe', p.segmentSize!) : row.productId;
          const withoutProduct = withoutProductId(row);
          return [
            {
              ...withoutProduct,
              size: segmentSize,
              quantity,
              // Panjang segmen adalah panjang yang diganti itu sendiri (ENG-903), bukan panjang
              // jalur dikali porsi yang dibulatkan: porsi 0,12 × 25,5 m menuliskan "3,1 m" di
              // tabel material sementara langkah hitung di halaman yang sama menulis "3 m".
              ...(row.netLengthM !== undefined ? { netLengthM: p.lengthM } : {}),
              ...(resized && ctx.existingFamily ? { item: `Pipa ${ctx.existingFamily}` } : {}),
              ...(segmentProduct !== undefined ? { productId: segmentProduct } : {}),
              basis: `${explain('ENG-903')} ${row.basis}`.trim(),
              traceIds: [...row.traceIds, ...idsOf('ENG-903')],
            },
          ];
        }
        if (row.pending === true) {
          return productId !== undefined && row.productId === productId ? [] : [row];
        }
        return [];
      });
      // Tanpa fakta bahan pipa lama tidak ada ENG-902, dan penyambungnya tetap sok keluarga baru.
      const jointRows =
        joints.length > 0
          ? joints
          : [{ kind: 'socket' as const, size: segmentSize, quantity: p.couplings }];
      for (const joint of jointRows) {
        const jointProduct = ctx.productFor?.(joint.kind, joint.size);
        bom.push({
          item: jointNameOf(joint.kind, ctx.existingFamily ?? ctx.family, locale),
          system: ctx.system ?? 'clean_water',
          size: joint.size,
          quantity: joint.quantity,
          unit: bomUnitLabel('pcs', locale),
          basis: `${explain('ENG-902')} ${explain('ENG-903')}`.trim(),
          provenance: provenanceFor(allTraces, [...idsOf('ENG-902'), ...idsOf('ENG-903')]),
          traceIds: [...idsOf('ENG-902'), ...idsOf('ENG-903')],
          // Kopling transisi PE belum punya keluarga di katalog Pralon aktif. Barisnya tetap ada
          // TANPA SKU — dan baris tanpa SKU sudah ditandai `not_in_catalog` ("pakai produk
          // setara") oleh `boqFrom`. Menghapusnya membuat gambar kerjanya menyuruh menyambung
          // HDPE dengan sok lem.
          ...(jointProduct ? { productId: jointProduct } : {}),
        });
      }
      highlights.push({
        label: en ? 'Replaced' : 'Yang diganti',
        value: `${String(p.lengthM).replace('.', en ? '.' : ',')} m`,
      });
      systemLines.push({
        name: en ? 'Replaced segment' : 'Segmen yang diganti',
        path: en ? 'Cut → rejoin' : 'Potong → sambung kembali',
        size: segmentSize,
        reason: `${explain('ENG-903')} ${explain('ENG-902')}`.trim(),
        provenance: provenanceFor(allTraces, [...idsOf('ENG-903'), ...idsOf('ENG-902')]),
        traceIds: [...idsOf('ENG-903'), ...idsOf('ENG-902')],
        role: 'main',
      });
      const sized =
        p.segmentSize === null
          ? ''
          : en
            ? ` The segment keeps the existing ${p.segmentSize} size.`
            : ` Segmennya mengikuti ukuran pipa lama, ${p.segmentSize}.`;
      sentences.push(
        en
          ? `${label}: only the ${p.lengthM} m segment is replaced and rejoined to the existing pipe with ${p.couplings} couplings.${sized}`
          : `${label}: hanya segmen ${String(p.lengthM).replace('.', ',')} m yang diganti dan disambung kembali ke pipa lama dengan ${p.couplings} sambungan.${sized}`,
      );
      // Pipa lama yang lebih kecil dari kebutuhan beban: dikatakan, tidak diganti diam-diam.
      // Memperbesar jalur adalah pekerjaan lain (ganti semua), bukan efek samping penggantian
      // sebagian — dan di segmen 3 m pun pembatasnya tetap pipa lama di kedua sisinya.
      if (result.capacity) {
        const c = result.capacity;
        existingPipe = {
          mode: facts.mode,
          size: c.existingSize,
          sufficient: c.sufficient,
          requiredSize: c.requiredSize,
        };
        if (!c.sufficient) {
          sentences.push(
            en
              ? `The existing ${c.existingSize} pipe is smaller than the ${c.requiredSize} this load needs, so the flow stays limited by the pipe on either side of the segment; enlarging the line means replacing the whole run.`
              : `Pipa lama ${c.existingSize} lebih kecil daripada ${c.requiredSize} yang dibutuhkan beban ini, jadi debitnya tetap dibatasi pipa lama di kedua sisi segmen; memperbesar jalurnya berarti mengganti seluruh jalur.`,
          );
        }
        highlights.push({
          label: en ? 'Existing pipe' : 'Pipa lama',
          value: c.sufficient
            ? `${c.existingSize} · ${en ? `sufficient for ${c.requiredSize}` : `cukup (butuh ${c.requiredSize})`}`
            : `${c.existingSize} · ${en ? `smaller than ${c.requiredSize}` : `lebih kecil dari ${c.requiredSize}`}`,
        });
      }
    }
  }

  const house = recommendation.kind === undefined || recommendation.kind === 'building';
  if (facts.mode === 'replace_all' && !house) {
    sentences.push(
      en
        ? `${label}: the existing pipes are replaced along the same runs, so the material list equals a new installation; the old pipes are removed during the work.`
        : `${label}: pipa lama diganti pada jalur yang sama, jadi daftar materialnya sama dengan instalasi baru; pipa lama dilepas saat pemasangan.`,
    );
  }

  // Asumsi pemanggil (beban titik air lama) hanya bila beban totalnya memang dihitung.
  const extra = result.totalLoad !== null ? (ctx.extraAssumptionIds ?? []) : [];
  for (const aid of [...result.appliedAssumptionIds, ...extra]) {
    const a = applyAssumption(aid);
    assumptions.push({
      text: assumptionDescription(aid, locale),
      fieldPath: a.parameter,
      ruleId: facts.mode === 'replace_partial' ? 'ENG-903' : 'ENG-901',
      assumptionId: a.id,
    });
  }

  // Judul: jenis pekerjaan di depan, kecuali rumah ganti-semua yang judulnya sudah menyebutnya.
  const prefixed =
    facts.mode === 'replace_all' && house
      ? recommendation.headline
      : `${label}: ${recommendation.headline.charAt(0).toLowerCase()}${recommendation.headline.slice(1)}`;
  const body =
    sentences.length > 0 ? `${sentences.join(' ')} ${recommendation.body}` : recommendation.body;

  return {
    recommendation: {
      ...recommendation,
      headline: prefixed,
      body,
      ...(recommendation.highlights
        ? { highlights: [...recommendation.highlights, ...highlights] }
        : {}),
      systemLines: [...recommendation.systemLines, ...systemLines],
      existingPipe,
      bom,
      assumptions,
    },
    traces: allTraces,
    result,
  };
}
