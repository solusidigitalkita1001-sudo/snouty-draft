import { resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reportDownloadName, resolveReportFile } from './report-file.js';

const ROOT = resolve('/srv/snouty/storage');

describe('resolveReportFile', () => {
  it('mengubah fileRef POSIX menjadi jalur absolut di dalam akar penyimpanan', () => {
    expect(resolveReportFile(ROOT, 'reports/01ABC.pdf')).toBe(
      [ROOT, 'reports', '01ABC.pdf'].join(sep),
    );
  });

  it('menolak fileRef yang keluar dari akar — nilai database tetap masukan', () => {
    for (const bad of ['../.env', 'reports/../../secret', '/etc/passwd', '..']) {
      expect(() => resolveReportFile(ROOT, bad), bad).toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' }),
      );
    }
  });

  it('menolak akar itu sendiri — bukan sebuah berkas', () => {
    expect(() => resolveReportFile(ROOT, '.')).toThrow();
  });
});

describe('reportDownloadName', () => {
  it('memakai nomor laporan dan membuang karakter di luar nama berkas yang aman', () => {
    expect(reportDownloadName('SNTY-2026-10-0001')).toBe('SNTY-2026-10-0001.pdf');
    expect(reportDownloadName('A/B C')).toBe('A_B_C.pdf');
  });
});
