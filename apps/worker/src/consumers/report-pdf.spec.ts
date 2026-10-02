/**
 * P8-08a — konsumer PDF: mengambil halaman cetak, mencetak, menyimpan dengan nama yang
 * **diturunkan dari reportId** (idempoten), lalu melaporkan READY lewat API.
 *
 * Diuji dengan browser palsu: yang ingin dibuktikan bukan Chromium bisa mencetak PDF —
 * itu urusan Chromium — melainkan bahwa urutannya benar, berkasnya tidak menumpuk saat
 * job diulang, dan kegagalan di setiap langkah melempar alih-alih menulis berkas rusak.
 */
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTRACT_VERSION } from '@snouty/jobs';
import { reportPdfConsumer, type PrintableBrowser } from './report-pdf.js';

const JOB = {
  contractVersion: CONTRACT_VERSION,
  correlationId: '01JBCORRELATION00000000000',
  reportId: '01JBREPORT000000000000000A',
} as const;

const CONTEXT = { correlationId: JOB.correlationId, attempt: 1 };
const log = pino({ level: 'silent' });

function fakeBrowser(pdf = Buffer.from('%PDF-1.4 palsu')): {
  browser: PrintableBrowser;
  calls: { content: string[]; closed: number };
} {
  const calls = { content: [] as string[], closed: 0 };
  return {
    calls,
    browser: {
      newPage: () =>
        Promise.resolve({
          setContent: (html: string) => {
            calls.content.push(html);
            return Promise.resolve();
          },
          pdf: () => Promise.resolve(pdf),
          close: () => Promise.resolve(),
        }),
      close: () => {
        calls.closed += 1;
        return Promise.resolve();
      },
    },
  };
}

let storagePath: string;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  storagePath = await mkdtemp(join(tmpdir(), 'snouty-report-'));
  fetchMock = vi.fn((url: string) => {
    if (url.endsWith('/print')) {
      return Promise.resolve(new Response('<html>laporan</html>', { status: 200 }));
    }
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

function deps(browser: PrintableBrowser) {
  return {
    apiBaseUrl: 'http://api.uji',
    internalToken: 'token-uji',
    storagePath,
    log,
    launchBrowser: () => Promise.resolve(browser),
  };
}

describe('konsumer PDF laporan', () => {
  it('menulis PDF dengan nama diturunkan dari reportId', async () => {
    const { browser } = fakeBrowser();
    await reportPdfConsumer(deps(browser))(JOB, CONTEXT);

    const files = await readdir(join(storagePath, 'reports'));
    expect(files).toEqual([`${JOB.reportId}.pdf`]);
  });

  it('job yang diulang menimpa berkas yang sama — tidak menumpuk duplikat', async () => {
    // Idempotensi per reportId (docs/REPORT.md §5): dua percobaan, satu berkas.
    const { browser } = fakeBrowser();
    const handle = reportPdfConsumer(deps(browser));
    await handle(JOB, CONTEXT);
    await handle(JOB, { ...CONTEXT, attempt: 2 });

    expect(await readdir(join(storagePath, 'reports'))).toHaveLength(1);
  });

  it('mencetak HTML yang diambil dari rute internal, bukan memintanya ulang', async () => {
    const { browser, calls } = fakeBrowser();
    await reportPdfConsumer(deps(browser))(JOB, CONTEXT);

    expect(calls.content).toEqual(['<html>laporan</html>']);
    const printCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/print'));
    expect(printCalls).toHaveLength(1);
  });

  it('mengirim token internal pada permintaan halaman cetak', async () => {
    const { browser } = fakeBrowser();
    await reportPdfConsumer(deps(browser))(JOB, CONTEXT);

    const [, init] = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/print'))!;
    expect((init as RequestInit).headers).toMatchObject({
      authorization: 'Bearer token-uji',
    });
  });

  it('melaporkan READY beserta fileRef relatif', async () => {
    const { browser } = fakeBrowser();
    await reportPdfConsumer(deps(browser))(JOB, CONTEXT);

    const [url, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/ready'))!;
    expect(String(url)).toContain(JOB.reportId);
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      fileRef: `reports/${JOB.reportId}.pdf`,
    });
  });

  it('selalu menutup browser, termasuk saat pencetakan gagal', async () => {
    const calls = { closed: 0 };
    const browser: PrintableBrowser = {
      newPage: () =>
        Promise.resolve({
          setContent: () => Promise.resolve(),
          pdf: () => Promise.reject(new Error('Chromium mati')),
          close: () => Promise.resolve(),
        }),
      close: () => {
        calls.closed += 1;
        return Promise.resolve();
      },
    };

    await expect(reportPdfConsumer(deps(browser))(JOB, CONTEXT)).rejects.toThrow('Chromium mati');
    // Browser yang tidak ditutup berarti proses Chromium menumpuk sampai worker mati.
    expect(calls.closed).toBe(1);
  });

  it('halaman cetak gagal: melempar TANPA menulis berkas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('tidak boleh', { status: 401 }))),
    );
    const { browser } = fakeBrowser();

    await expect(reportPdfConsumer(deps(browser))(JOB, CONTEXT)).rejects.toThrow('401');
    // Berkas rusak lebih buruk daripada tidak ada berkas: pengguna akan mengunduhnya.
    await expect(readdir(join(storagePath, 'reports'))).rejects.toThrow();
  });

  it('penandaan READY gagal: melempar supaya job dicoba lagi', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith('/print')
            ? new Response('<html>laporan</html>', { status: 200 })
            : new Response(null, { status: 500 }),
        ),
      ),
    );
    const { browser } = fakeBrowser();

    // Berkasnya sudah ditulis, tetapi statusnya belum READY — job harus diulang supaya
    // laporan tidak tertinggal PENDING selamanya dengan PDF yang sebenarnya sudah ada.
    await expect(reportPdfConsumer(deps(browser))(JOB, CONTEXT)).rejects.toThrow('500');
    expect(await readdir(join(storagePath, 'reports'))).toHaveLength(1);
  });

  it('isi PDF benar-benar ditulis ke berkas', async () => {
    const pdf = Buffer.from('%PDF-1.4 isi nyata');
    const { browser } = fakeBrowser(pdf);
    await reportPdfConsumer(deps(browser))(JOB, CONTEXT);

    const written = await readFile(join(storagePath, 'reports', `${JOB.reportId}.pdf`));
    expect(written.equals(pdf)).toBe(true);
  });
});
