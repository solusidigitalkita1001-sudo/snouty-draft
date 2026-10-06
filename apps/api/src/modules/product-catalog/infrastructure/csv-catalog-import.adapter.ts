/**
 * Adapter impor CSV (RFC 4180, UTF-8) → `CatalogImportSource`. docs/PRODUCT_KNOWLEDGE.md §3.
 *
 * Yang dilakukan di sini hanya membaca bentuk berkas: header menjadi `columns`, tiap baris
 * menjadi sel string apa adanya. Nilai jamak (`3/4; 1`) **tidak** dipecah di sini — validator yang
 * memilikinya (`CATALOG_IMPORT_MULTI_VALUE_SEPARATOR`), supaya bentuk berkas tidak merembes ke
 * aturan. Kontrak tidak berubah; adapter Excel/ERP berikutnya menghasilkan bentuk yang sama.
 *
 * Yang diterima: koma sebagai pemisah, sel berkutip ganda dengan `""` sebagai escape, baris baru
 * di dalam sel berkutip, CRLF maupun LF, BOM UTF-8 di awal berkas. Kolom yang tidak dikenal ikut
 * dibawa (validator mengabaikannya; sidik jari baris memasukkannya, dan itu benar: ia bagian data).
 */
import type {
  CatalogImportAdapter,
  CatalogImportSource,
  RawCatalogRow,
} from '../domain/catalog-import.contract.js';

export class CsvCatalogImportError extends Error {
  constructor(
    readonly line: number,
    detail: string,
  ) {
    super(`CSV tidak sah di baris ${line}: ${detail}`);
    this.name = 'CsvCatalogImportError';
  }
}

export class CsvCatalogImportAdapter implements CatalogImportAdapter {
  readonly format = 'csv';

  supports(filename: string, mimeType: string): boolean {
    return /\.csv$/i.test(filename) || /^text\/csv\b/i.test(mimeType);
  }

  async read(input: {
    readonly label: string;
    readonly sourceDocument: string;
    readonly bytes: Uint8Array;
  }): Promise<CatalogImportSource> {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(input.bytes);
    return parseCsvCatalog(text, input.label, input.sourceDocument);
  }
}

/** Murni: dipisah dari kelas supaya bisa diuji tanpa `Uint8Array` dan dipakai skrip CLI. */
export function parseCsvCatalog(
  text: string,
  label: string,
  sourceDocument: string,
): CatalogImportSource {
  const records = parseRecords(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  const header = records[0];
  if (header === undefined || header.fields.every((cell) => cell.trim() === '')) {
    throw new CsvCatalogImportError(1, 'header kosong — baris pertama harus nama kolom.');
  }
  const columns = header.fields.map((cell) => cell.trim());
  const duplicate = columns.find((column, index) => columns.indexOf(column) !== index);
  if (duplicate !== undefined) {
    throw new CsvCatalogImportError(1, `kolom \`${duplicate}\` muncul dua kali di header.`);
  }

  const rows: RawCatalogRow[] = [];
  for (const record of records.slice(1)) {
    // Baris yang seluruhnya kosong (biasanya baris terakhir) bukan data.
    if (record.fields.every((cell) => cell.trim() === '')) continue;
    if (record.fields.length > columns.length) {
      throw new CsvCatalogImportError(
        record.line,
        `${record.fields.length} sel, padahal header hanya ${columns.length} kolom.`,
      );
    }
    const values: Record<string, string> = {};
    columns.forEach((column, index) => {
      const cell = record.fields[index] ?? '';
      // Sel kosong tidak dibawa: validator membedakan "kolom tidak ada" dari "sel kosong"
      // lewat `columns`, dan sidik jari baris membuang sel kosong dengan sendirinya.
      if (cell !== '') values[column] = cell;
    });
    rows.push({ rowNumber: record.line, values });
  }
  return { label, sourceDocument, columns, rows };
}

interface CsvRecord {
  /** Nomor baris fisik tempat record dimulai (header = 1). */
  readonly line: number;
  readonly fields: readonly string[];
}

/** Pembaca RFC 4180 satu lintasan; kutip ganda hanya bermakna di awal sel. */
function parseRecords(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let recordLine = 1;
  let i = 0;

  const endField = () => {
    fields.push(cell);
    cell = '';
  };
  const endRecord = () => {
    endField();
    records.push({ line: recordLine, fields });
    fields = [];
    recordLine = line;
  };

  while (i < text.length) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      if (ch === '\n') line += 1;
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      if (cell !== '') {
        throw new CsvCatalogImportError(line, 'tanda kutip di tengah sel tanpa kutip pembuka.');
      }
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      endField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      line += 1;
      endRecord();
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (quoted) throw new CsvCatalogImportError(recordLine, 'sel berkutip tidak ditutup.');
  if (cell !== '' || fields.length > 0) endRecord();
  return records;
}
