import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileVectorCache } from './file-vector.cache.js';

describe('FileVectorCache', () => {
  it('penyimpanan per katalog tidak membuang entri; prune hanya membuang yang tidak dipakai lagi', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vc-'));
    const first = new FileVectorCache(dir);
    first.set('enc', 'lama', Float32Array.from([1, 0]));
    first.set('enc', 'a', Float32Array.from([0.123456789, 1]));
    first.set('enc', 'b', Float32Array.from([0, 1]));
    await first.flush();

    // Boot berikutnya: 'a' dan 'b' dipakai dari cache, 'lama' sudah dihapus dari data.
    const second = new FileVectorCache(dir);
    expect(second.get('enc', 'a')?.[0]).toBeCloseTo(0.12346, 5);
    await second.flush(); // per katalog — tidak ada yang hilang
    expect(Object.keys(JSON.parse(readFileSync(join(dir, 'enc.json'), 'utf8')))).toHaveLength(3);
    expect(second.get('enc', 'b')).toBeDefined();
    await second.prune();
    expect(Object.keys(JSON.parse(readFileSync(join(dir, 'enc.json'), 'utf8')))).toHaveLength(2);
    expect(new FileVectorCache(dir).get('enc', 'lama')).toBeUndefined();
  });
});
