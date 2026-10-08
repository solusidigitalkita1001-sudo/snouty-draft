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
  /** Membuang vektor contoh yang tidak dipakai lagi (contoh dihapus dari data) lalu menulis ulang. */
  prune(): Promise<boolean>;
}

export class FileVectorCache implements VectorCache {
  private readonly files = new Map<string, Map<string, number[]>>();
  private dirty = new Set<string>();

  constructor(readonly dir: string = join(tmpdir(), 'snouty-understanding')) {}

  /** Kunci yang dipakai proses ini — contoh yang sudah dihapus dari data tidak ditulis lagi. */
  private readonly touched = new Map<string, Set<string>>();

  get(encoderId: string, text: string): Float32Array | undefined {
    const key = hash(text);
    const values = this.table(encoderId).get(key);
    if (values) this.touch(encoderId, key);
    return values ? Float32Array.from(values) : undefined;
  }

  set(encoderId: string, text: string, vector: Float32Array): void {
    const key = hash(text);
    // Lima desimal cukup untuk kosinus (selisih < 1e-5); berkasnya ±40% lebih kecil.
    this.table(encoderId).set(
      key,
      Array.from(vector, (v) => Number(v.toFixed(5))),
    );
    this.touch(encoderId, key);
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

  async prune(): Promise<boolean> {
    for (const [encoderId, table] of this.files) {
      const used = this.touched.get(encoderId) ?? new Set<string>();
      for (const key of [...table.keys()]) {
        if (!used.has(key)) {
          table.delete(key);
          this.dirty.add(encoderId);
        }
      }
    }
    return this.flush();
  }

  private touch(encoderId: string, key: string): void {
    let keys = this.touched.get(encoderId);
    if (!keys) {
      keys = new Set();
      this.touched.set(encoderId, keys);
    }
    keys.add(key);
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
