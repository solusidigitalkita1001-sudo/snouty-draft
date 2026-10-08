/**
 * Penyimpanan berkas lampiran di `STORAGE_PATH/uploads/<id>` — di luar web root, nama berkas
 * ULID (docs/SECURITY.md §7). Jalur selalu dibangun dari id yang sudah divalidasi; tidak ada
 * masukan pengguna yang menyentuh path.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export interface FileStore {
  write(id: string, bytes: Uint8Array): Promise<void>;
  pathOf(id: string): string;
  remove(id: string): Promise<void>;
}

export class LocalFileStore implements FileStore {
  private readonly dir: string;

  constructor(storageRoot: string) {
    this.dir = resolve(storageRoot, 'uploads');
  }

  async write(id: string, bytes: Uint8Array): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    // `wx`: tidak pernah menimpa berkas yang sudah ada.
    await writeFile(this.pathOf(id), bytes, { flag: 'wx', mode: 0o640 });
  }

  pathOf(id: string): string {
    if (!ULID.test(id)) throw new Error('id lampiran tidak sah');
    const path = resolve(join(this.dir, id));
    if (!path.startsWith(this.dir + sep)) throw new Error('jalur lampiran di luar penyimpanan');
    return path;
  }

  async remove(id: string): Promise<void> {
    await rm(this.pathOf(id), { force: true });
  }
}
