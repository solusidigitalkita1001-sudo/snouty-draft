/**
 * Validasi impor katalog — murni, tanpa I/O, tanpa framework.
 *
 * Satu keputusan membentuk seluruh berkas ini: **validasi tidak pernah berhenti
 * di galat pertama.** Seluruh baris diperiksa, seluruh galat dikumpulkan, lalu
 * dilaporkan sekaligus. Alasannya bukan kerapian: memperbaiki 40 galat satu per
 * satu, masing-masing menunggu satu putaran impor, adalah cara tercepat membuat
 * admin katalog menyerah (docs/PRODUCT_KNOWLEDGE.md §3).
 *
 * Tidak memakai zod di sini, dan itu disengaja. zod bagus untuk DTO di batas HTTP
 * — gagal cepat, satu objek, satu respons galat. Di sini yang dibutuhkan justru
 * kebalikannya: ratusan baris yang masing-masing boleh gagal sendiri, dengan
 * laporan yang menyebut nomor baris dan nama kolom.
 *
 * Isi berkas yang diunggah adalah **data, bukan instruksi**: tidak ada nilai dari
 * sini yang menjadi perintah, dan `image_url` dibatasi skema yang aman dirender.
 */

import { createHash } from 'node:crypto';
import {
  PipeSize,
  type CatalogImportIssue,
  type FittingKind,
  type ProductStatus,
  type SpecValue,
} from '@snouty/shared-types';
import {
  CATALOG_IMPORT_COLUMNS,
  CATALOG_IMPORT_MULTI_VALUE_SEPARATOR,
  type CatalogCompatibilityRef,
  type CatalogImportSource,
  type CatalogImportValidation,
  type RawCatalogRow,
  type ValidatedCatalogRow,
} from './catalog-import.contract.js';
import { CATALOG_SPEC_KEY_LIST, type CatalogSpecKey } from './catalog-spec-keys.js';
import { specFromCatalogColumn } from './spec-value.js';

/** `rowNumber` ini berarti "berlaku untuk seluruh berkas", bukan satu baris. */
const FILE_LEVEL = 0;

const FITTING_KINDS: readonly string[] = ['tee', 'elbow', 'reducer', 'socket'];
const PRODUCT_STATUSES: readonly string[] = ['active', 'discontinued'];

/** Nilai jamak dipisah `;` atau baris baru; keduanya lazim di sel spreadsheet. */
const MULTI_VALUE_PATTERN = new RegExp(`[${CATALOG_IMPORT_MULTI_VALUE_SEPARATOR}\\n]`);

/**
 * Hanya URL absolut http(s) atau jalur relatif dari akar situs.
 * `image_url` berakhir di atribut `src`, jadi skema lain tidak dibiarkan lewat
 * meski katalog adalah sumber yang relatif tepercaya (docs/SECURITY.md §5).
 */
const SAFE_IMAGE_URL = /^(?:https?:\/\/|\/)/i;

/**
 * Pemisah antar-field saat membangun sidik jari baris: UNIT SEPARATOR, karakter
 * yang tidak bisa muncul di sel spreadsheet. Tanpa pemisah yang mustahil ditulis
 * pengguna, dua baris berbeda bisa menghasilkan serialisasi yang sama.
 */
const HASH_FIELD_SEPARATOR = '\u001f';

/** Keadaan satu baris selama validasi. `fields` null berarti baris gugur di jalur pertama. */
interface RowDraft {
  readonly rowNumber: number;
  readonly issues: CatalogImportIssue[];
  /**
   * SKU apa adanya, juga saat barisnya gugur. Dipisahkan dari `fields` karena
   * rujukan kompatibilitas ke baris yang bergalat tetap rujukan yang sah.
   */
  readonly rawSku: string;
  readonly fields: Omit<ValidatedCatalogRow, 'compatibleSkus'> | null;
  readonly refs: readonly CatalogCompatibilityRef[];
}

export function validateCatalogImport(source: CatalogImportSource): CatalogImportValidation {
  const fileIssues: CatalogImportIssue[] = [];

  if (source.label.trim() === '') {
    fileIssues.push(issue(FILE_LEVEL, 'label', 'Label versi katalog wajib diisi.'));
  }

  const present = new Set(source.columns);
  const missing = CATALOG_IMPORT_COLUMNS.required.filter((column) => !present.has(column));
  for (const column of missing) {
    fileIssues.push(issue(FILE_LEVEL, column, `Kolom wajib \`${column}\` tidak ada di berkas.`));
  }

  // Kolom wajib yang hilang akan menggagalkan setiap baris dengan galat yang sama.
  // Melaporkannya 500 kali menenggelamkan masalah sesungguhnya: perbaiki header dulu.
  if (missing.length > 0) return { rows: [], issues: fileIssues };

  const drafts = source.rows.map((row) => validateRow(row, source.sourceDocument));
  resolveAcrossRows(drafts);

  const rows: ValidatedCatalogRow[] = [];
  for (const draft of drafts) {
    if (draft.issues.length > 0 || draft.fields === null) continue;
    rows.push({ ...draft.fields, compatibleSkus: draft.refs });
  }

  return { rows, issues: [...fileIssues, ...drafts.flatMap((draft) => draft.issues)] };
}

function validateRow(row: RawCatalogRow, defaultSourceDocument: string): RowDraft {
  const issues: CatalogImportIssue[] = [];

  /** Sel bernilai tunggal. Daftar di kolom semacam ini hampir pasti salah peta kolom. */
  const single = (column: string): string => {
    const raw = row.values[column];
    if (raw === undefined) return '';
    if (typeof raw !== 'string') {
      if (raw.length > 1) {
        issues.push(issue(row.rowNumber, column, `Kolom \`${column}\` hanya menerima satu nilai.`));
        return '';
      }
      return (raw[0] ?? '').trim();
    }
    return raw.trim();
  };

  const required = (column: string): string => {
    const value = single(column);
    if (value === '') {
      issues.push(issue(row.rowNumber, column, `Kolom \`${column}\` wajib diisi.`));
    }
    return value;
  };

  const sku = required('sku');
  const name = required('name');
  const family = required('family');
  const category = required('category');

  const sourcePage = parseSourcePage(single('source_page'));
  if (sourcePage === null) {
    issues.push(
      issue(
        row.rowNumber,
        'source_page',
        'Kolom `source_page` harus bilangan bulat positif — rujukan halaman adalah janji bahwa data ini bisa dicek.',
      ),
    );
  }

  const sourceDocument = single('source_document') || defaultSourceDocument.trim();
  if (sourceDocument === '') {
    issues.push(
      issue(
        row.rowNumber,
        'source_document',
        'Dokumen sumber wajib ada, dari kolom `source_document` atau dari metadata berkas.',
      ),
    );
  }

  const rawStatus = single('status');
  const status = rawStatus === '' ? 'active' : rawStatus;
  if (!PRODUCT_STATUSES.includes(status)) {
    issues.push(
      issue(
        row.rowNumber,
        'status',
        `Status \`${status}\` tidak dikenal; pakai active atau discontinued.`,
      ),
    );
  }

  const imageUrl = single('image_url');
  if (imageUrl !== '' && !SAFE_IMAGE_URL.test(imageUrl)) {
    issues.push(
      issue(
        row.rowNumber,
        'image_url',
        `\`${imageUrl}\` bukan URL http(s) maupun jalur yang dimulai dengan /.`,
      ),
    );
  }

  const sizes = parseSizes(multi(row.values['sizes']));
  if (sizes.unreadable.length > 0) {
    issues.push(
      issue(row.rowNumber, 'sizes', `Ukuran tidak terbaca: ${sizes.unreadable.join(', ')}.`),
    );
  }

  const refs = parseCompatibilityRefs(multi(row.values['compatible_skus']), sku);
  if (refs.problems.length > 0) {
    issues.push(issue(row.rowNumber, 'compatible_skus', refs.problems.join(' ')));
  }

  const description = single('description');
  const specs = readSpecs(single);

  const fields =
    issues.length > 0 || sourcePage === null
      ? null
      : {
          rowNumber: row.rowNumber,
          rowHash: hashRow(row.values),
          sku,
          name,
          family,
          category,
          description: description === '' ? null : description,
          status: status as ProductStatus,
          sourceDocument,
          sourcePage,
          imageUrl: imageUrl === '' ? null : imageUrl,
          sizes: sizes.parsed,
          specs,
        };

  return { rowNumber: row.rowNumber, issues, rawSku: sku, fields, refs: refs.parsed };
}

/**
 * SKU ganda dan rujukan menggantung hanya bisa dilihat setelah seluruh baris dibaca.
 *
 * Himpunan SKU yang dikenal diambil dari **semua** baris yang menyebutkan SKU,
 * termasuk baris yang gagal karena alasan lain. Kalau tidak, satu salah ketik pada
 * baris fitting akan memunculkan galat "SKU tidak ada" di setiap baris pipa yang
 * merujuknya, dan admin akan memperbaiki gejalanya, bukan penyebabnya.
 */
function resolveAcrossRows(drafts: readonly RowDraft[]): void {
  const known = new Set<string>();
  for (const draft of drafts) {
    const sku = draft.rawSku;
    if (sku !== '') known.add(sku.toLowerCase());
  }

  const firstSeen = new Map<string, number>();
  for (const draft of drafts) {
    const sku = draft.rawSku;
    if (sku === '') continue;

    const key = sku.toLowerCase();
    const earlier = firstSeen.get(key);
    if (earlier === undefined) {
      firstSeen.set(key, draft.rowNumber);
      continue;
    }
    // Collation baku MySQL tidak membedakan huruf besar-kecil, jadi validasi juga
    // tidak boleh. Kalau tidak, `uq_products_version_sku` yang akan meledak saat
    // job berjalan — jauh dari admin yang bisa memperbaikinya.
    draft.issues.push(
      issue(draft.rowNumber, 'sku', `SKU \`${sku}\` sudah dipakai di baris ${earlier}.`),
    );
  }

  for (const draft of drafts) {
    const dangling = draft.refs.filter((ref) => !known.has(ref.sku.toLowerCase()));
    if (dangling.length === 0) continue;
    draft.issues.push(
      issue(
        draft.rowNumber,
        'compatible_skus',
        `SKU tidak ada di impor ini: ${dangling.map((ref) => ref.sku).join(', ')}.`,
      ),
    );
  }
}

/**
 * Keenam kunci selalu diisi, bahkan untuk baris yang tidak menyebutkan satu pun.
 * Keputusan kosong-atau-tidaknya diserahkan sepenuhnya ke `specFromCatalogColumn`,
 * supaya impor dan pembacaan tidak bisa menjawab berbeda untuk sel yang sama.
 */
function readSpecs(single: (column: string) => string): Record<CatalogSpecKey, SpecValue> {
  const specs = {} as Record<CatalogSpecKey, SpecValue>;
  for (const key of CATALOG_SPEC_KEY_LIST) {
    specs[key] = specFromCatalogColumn(single(key));
  }
  return specs;
}

function parseSourcePage(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const page = Number(raw);
  return page > 0 ? page : null;
}

function parseSizes(tokens: readonly string[]): {
  parsed: readonly PipeSize[];
  unreadable: readonly string[];
} {
  const byInches = new Map<number, PipeSize>();
  const unreadable: string[] = [];

  for (const token of tokens) {
    const size = PipeSize.parse(token);
    if (size === null) unreadable.push(token);
    else byInches.set(size.inches, size);
  }

  return { parsed: PipeSize.sort([...byInches.values()]), unreadable };
}

function parseCompatibilityRefs(
  tokens: readonly string[],
  ownSku: string,
): { parsed: CatalogCompatibilityRef[]; problems: readonly string[] } {
  const parsed: CatalogCompatibilityRef[] = [];
  const problems: string[] = [];

  for (const token of tokens) {
    const separator = token.indexOf(':');
    if (separator === -1) {
      problems.push(`\`${token}\` tidak memakai bentuk SKU:jenis.`);
      continue;
    }

    const sku = token.slice(0, separator).trim();
    const kind = token.slice(separator + 1).trim();

    if (sku === '') {
      problems.push(`\`${token}\` tidak menyebutkan SKU.`);
      continue;
    }
    if (!FITTING_KINDS.includes(kind)) {
      problems.push(`Jenis fitting \`${kind}\` tidak dikenal; pakai ${FITTING_KINDS.join(', ')}.`);
      continue;
    }
    if (ownSku !== '' && sku.toLowerCase() === ownSku.toLowerCase()) {
      problems.push(`Produk tidak boleh kompatibel dengan dirinya sendiri (\`${sku}\`).`);
      continue;
    }

    parsed.push({ sku, kind: kind as FittingKind });
  }

  return { parsed, problems };
}

function multi(raw: string | readonly string[] | undefined): string[] {
  if (raw === undefined) return [];
  const parts = typeof raw === 'string' ? raw.split(MULTI_VALUE_PATTERN) : raw;
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}

/**
 * Sidik jari baris mentah. Kunci diurutkan supaya menukar urutan kolom bukan
 * perubahan data, dan sel kosong dibuang supaya menambahkan kolom kosong pun bukan.
 */
function hashRow(values: Readonly<Record<string, string | readonly string[]>>): string {
  const canonical = Object.keys(values)
    .sort()
    .map((key) => {
      const raw = values[key];
      const text =
        raw === undefined
          ? ''
          : typeof raw === 'string'
            ? raw.trim()
            : raw.map((part) => part.trim()).join(CATALOG_IMPORT_MULTI_VALUE_SEPARATOR);
      return { key, text };
    })
    .filter((entry) => entry.text !== '')
    .map((entry) => `${entry.key}=${entry.text}`)
    .join(HASH_FIELD_SEPARATOR);

  return createHash('sha256').update(canonical).digest('hex');
}

function issue(rowNumber: number, column: string, message: string): CatalogImportIssue {
  return { rowNumber, column, message };
}
