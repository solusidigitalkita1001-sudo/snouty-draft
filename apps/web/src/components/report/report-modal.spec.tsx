/**
 * Pratinjau laporan. Yang dipaku: identitas dikirim apa adanya (dipangkas), kalimat
 * kebijakan ESTIMASI utuh, kolom harga hanya saat `pricing.enabled`, tier yang tidak
 * berhak mendapat pesan — bukan percobaan ulang — dan "Unduh PDF" tidak menyala sebelum
 * PDF-nya READY.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReportPreview } from '@snouty/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReportResult } from './report-api';
import { formatRupiah } from './report-copy';
import { ReportModal } from './report-modal';

const createReport = vi.fn<(input: unknown) => Promise<ReportResult<unknown>>>();
const fetchReport = vi.fn<(id: string) => Promise<ReportResult<ReportPreview>>>();
const downloadReport = vi.fn<(id: string, fileName: string) => Promise<boolean>>();
vi.mock('./report-api', () => ({
  createReport: (input: unknown) => createReport(input),
  fetchReport: (id: string) => fetchReport(id),
  downloadReport: (id: string, fileName: string) => downloadReport(id, fileName),
}));

const REC = '01JBRECOMMEND00000000000001';

function preview(overrides: Partial<ReportPreview> = {}): ReportPreview {
  return {
    id: '01JBREPORT0000000000000001',
    reportNumber: 'SNTY-2026-10-0001',
    status: 'PENDING',
    createdAt: '2026-10-05T00:00:00.000Z',
    fileRef: null,
    payload: {
      reportNumber: 'SNTY-2026-10-0001',
      identity: {
        customerName: 'Budi',
        projectLocation: 'Bandung',
        consultationDate: '2026-10-05',
        installationType: 'Air bersih',
      },
      headline: 'Sistem 2 lantai dengan pipa utama 1".',
      body: 'Isi',
      requirements: [],
      systemLines: [],
      assumptions: [],
      bom: [
        {
          item: 'Pipa PVC AW 1"',
          size: '1"',
          quantity: 6,
          unit: 'batang',
          basis: 'ENG-009',
          provenance: 'ASSUMED',
          traceIds: [],
          subtotal: 1234000,
        },
      ],
      basis: [],
      pricing: { enabled: false, taxRatePercent: 11, subtotal: 0, taxAmount: 0, total: 0 },
      catalogVersionLabel: 'dev',
      overallProvenance: 'ASSUMED',
      locale: 'id',
    },
    ...overrides,
  };
}

async function openPreview(report: ReportPreview, onClose = () => {}) {
  createReport.mockResolvedValue({ kind: 'ok', value: { id: report.id } });
  fetchReport.mockResolvedValue({ kind: 'ok', value: report });
  render(<ReportModal recommendationId={REC} onClose={onClose} />);
  fireEvent.change(screen.getByLabelText('Nama pelanggan'), { target: { value: '  Budi ' } });
  fireEvent.change(screen.getByLabelText('Lokasi proyek'), { target: { value: 'Bandung' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lanjutkan' }));
  await screen.findByText('NO. SNTY-2026-10-0001 · ESTIMASI PERENCANAAN');
}

beforeEach(() => {
  createReport.mockReset();
  fetchReport.mockReset();
  downloadReport.mockReset();
});

describe('ReportModal', () => {
  it('mengirim identitas yang dipangkas lalu menampilkan pratinjau tanpa kolom harga', async () => {
    await openPreview(preview());

    expect(createReport).toHaveBeenCalledWith({
      recommendationId: REC,
      customerName: 'Budi',
      projectLocation: 'Bandung',
    });
    expect(screen.getByText('Sistem 2 lantai dengan pipa utama 1".')).toBeTruthy();
    expect(screen.getByText('Pipa PVC AW 1"')).toBeTruthy();
    expect(screen.getByText('6 batang')).toBeTruthy();
    expect(screen.queryByText('SUBTOTAL')).toBeNull();
    expect(screen.queryByText('Total estimasi')).toBeNull();
  });

  it('memuat kalimat kebijakan ESTIMASI apa adanya', async () => {
    await openPreview(preview());

    expect(
      screen.getByText(
        'Perkiraan perencanaan, bukan penawaran resmi. Harga final mengikuti daftar harga distributor Pralon.',
      ),
    ).toBeTruthy();
  });

  it('merender subtotal dan total hanya bila harga aktif', async () => {
    const report = preview();
    await openPreview({
      ...report,
      payload: {
        ...report.payload,
        pricing: {
          enabled: true,
          taxRatePercent: 11,
          subtotal: 1234000,
          taxAmount: 135740,
          total: 1369740,
        },
      },
    });

    expect(screen.getByText('SUBTOTAL')).toBeTruthy();
    expect(screen.getByText('PPN 11%')).toBeTruthy();
    expect(screen.getByText('Total estimasi')).toBeTruthy();
    expect(screen.getAllByText(formatRupiah(1234000)).length).toBeGreaterThan(0);
  });

  it('tier yang tidak berhak mendapat pesan, bukan percobaan ulang', async () => {
    createReport.mockResolvedValue({ kind: 'not-entitled' });
    render(<ReportModal recommendationId={REC} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Nama pelanggan'), { target: { value: 'Budi' } });
    fireEvent.change(screen.getByLabelText('Lokasi proyek'), { target: { value: 'Bandung' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lanjutkan' }));

    await screen.findByText(/Laporan PDF tersedia untuk akun lanjutan/);
    expect(fetchReport).not.toHaveBeenCalled();
    expect(createReport).toHaveBeenCalledTimes(1);
  });

  it('"Unduh PDF" tidak menyala sebelum READY', async () => {
    await openPreview(preview({ status: 'PENDING' }));
    expect((screen.getByRole('button', { name: 'Unduh PDF' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText('PDF sedang disiapkan…')).toBeTruthy();
  });

  it('READY menyalakan "Unduh PDF", yang mengunduh lewat fetch dengan nama nomor laporan', async () => {
    downloadReport.mockResolvedValue(true);
    await openPreview(preview({ status: 'READY', fileRef: 'reports/x.pdf' }));
    const button = screen.getByRole('button', { name: 'Unduh PDF' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    await waitFor(() =>
      expect(downloadReport).toHaveBeenCalledWith(
        '01JBREPORT0000000000000001',
        'SNTY-2026-10-0001.pdf',
      ),
    );
  });

  it('unduhan yang gagal dikatakan apa adanya', async () => {
    downloadReport.mockResolvedValue(false);
    await openPreview(preview({ status: 'READY', fileRef: 'reports/x.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unduh PDF' }));
    await screen.findByText('PDF belum bisa diunduh. Coba lagi sebentar lagi.');
  });

  it('Esc dan "Kembali ke solusi" menutup', async () => {
    const onClose = vi.fn();
    await openPreview(preview(), onClose);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Kembali ke solusi' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });
});
