/**
 * Cache vektor contoh di berkas — supaya boot berikutnya tidak menyandikan ulang ratusan
 * contoh (±20 detik di CPU). Kunci: id penyandi + teks; penyandi lain = berkas lain.
 * Kegagalan baca/tulis diabaikan: cache adalah percepatan, bukan sumber kebenaran.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface VectorCache {
  /** Lokasi cache — untuk pesan log bila tidak bisa ditulis. */
  readonly dir: string;
  get(encoderId: string, text: string): Float32Array | undefined;
  set(encoderId: string, text: string, vector: Float32Array): void;
  /** `false` bila ada berkas yang gagal ditulis — pemanggil mencatatnya, boot berikutnya menyandikan ulang. */
  flush(): Promise<boolean>;
}

export class FileVectorCache implements VectorCache {
  private readonly files = new Map<string, Map<string, number[]>>();
  private dirty = new Set<string>();

  constructor(readonly dir: string = join(tmpdir(), 'snouty-understanding')) {}

  get(encoderId: string, text: string): Float32Array | undefined {
    const values = this.table(encoderId).get(hash(text));
    return values ? Float32Array.from(values) : undefined;
  }

  set(encoderId: string, text: string, vector: Float32Array): void {
    this.table(encoderId).set(hash(text), Array.from(vector));
    this.dirty.add(encoderId);
  }

  async flush(): Promise<boolean> {
    let ok = true;
    for (const encoderId of this.dirty) {
      try {
        mkdirSync(this.dir, { recursive: true });
        writeFileSync(
          this.path(encoderId),
          JSON.stringify(Object.fromEntries(this.table(encoderId))),
        );
      } catch {
        // Disk hanya-baca, penuh, atau bukan milik pengguna proses: boot berikutnya menyandikan
        // ulang. Bukan kegagalan — tetapi dilaporkan, karena di CPU server itu ±7 menit.
        ok = false;
      }
    }
    this.dirty = new Set();
    return ok;
  }

  private table(encoderId: string): Map<string, number[]> {
    let table = this.files.get(encoderId);
    if (table) return table;
    table = new Map();
    try {
      const path = this.path(encoderId);
      if (existsSync(path)) {
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, number[]>;
        for (const [key, values] of Object.entries(parsed)) table.set(key, values);
      }
    } catch {
      // Berkas rusak: mulai kosong.
    }
    this.files.set(encoderId, table);
    return table;
  }

  private path(encoderId: string): string {
    return join(this.dir, `${encoderId.replace(/[^a-z0-9._-]/gi, '_')}.json`);
  }
}

function hash(text: string): string {
  return createHash('sha1').update(text).digest('hex');
}
