/**
 * Fitur akun Fase 24: menu baris (sematkan, pindah proyek, hapus), halaman proyek (buat, catatan,
 * konsultasi baru di proyek), dialog bagikan (buat, salin, cabut), halaman tautan publik.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProjectDetail } from '@snouty/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { libraryCopy } from './library-copy';
import { ProjectView } from './project-view';
import { RowMenu } from './row-menu';
import { ShareDialog } from './share-dialog';
import { SharedSolutionPage } from './shared-solution-page';

const api = vi.hoisted(() => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  fetchShareStatus: vi.fn(),
  createShare: vi.fn(),
  revokeShare: vi.fn(),
  fetchShared: vi.fn(),
}));
vi.mock('./library-api', () => api);

const COPY = libraryCopy('id');
const PROJECT: ProjectDetail = {
  id: 'P'.repeat(26),
  name: 'Rumah Bekasi',
  notes: 'sumber air PDAM',
  createdAt: '2026-10-19T00:00:00.000Z',
  updatedAt: '2026-10-19T00:00:00.000Z',
  conversations: [
    {
      id: 'C'.repeat(26),
      title: 'Rumah 2 lantai',
      status: 'SOLUTION_READY',
      stage: 'SOLUSI',
      language: 'id',
      createdAt: '2026-10-19T00:00:00.000Z',
      updatedAt: '2026-10-19T00:00:00.000Z',
    },
  ],
};

afterEach(() => vi.clearAllMocks());

describe('RowMenu', () => {
  it('sematkan, pindah ke proyek lain, keluarkan dari proyek, hapus', () => {
    const onPin = vi.fn();
    const onMove = vi.fn();
    const onDelete = vi.fn();
    const projects = [
      { ...PROJECT, id: 'A'.repeat(26), name: 'Kos Depok' },
      { ...PROJECT, id: 'B'.repeat(26), name: 'SPAM Desa' },
    ];
    render(
      <RowMenu
        title="Rumah 2 lantai"
        pinned={false}
        projectId={'A'.repeat(26)}
        projects={projects}
        onPin={onPin}
        onMove={onMove}
        onDelete={onDelete}
      />,
    );
    const open = () => fireEvent.click(screen.getByLabelText(COPY.menu('Rumah 2 lantai')));
    open();
    // Proyek tempat konsultasi berada tidak ditawarkan lagi.
    expect(screen.queryByText('Kos Depok')).toBeNull();
    fireEvent.click(screen.getByText(COPY.pin));
    expect(onPin).toHaveBeenCalledWith(true);
    open();
    fireEvent.click(screen.getByText('SPAM Desa'));
    expect(onMove).toHaveBeenCalledWith('B'.repeat(26));
    open();
    fireEvent.click(screen.getByText(COPY.removeFromProject));
    expect(onMove).toHaveBeenLastCalledWith(null);
    open();
    fireEvent.click(screen.getByText(COPY.delete));
    expect(onDelete).toHaveBeenCalled();
  });
});

describe('ProjectView', () => {
  const noop = () => undefined;
  const props = {
    onCreated: vi.fn(),
    onUpdated: vi.fn(),
    onDeleted: vi.fn(),
    onCancel: noop,
    onNewConversation: vi.fn(),
    onOpenConversation: vi.fn(),
    formatDate: () => '19 OKT',
  };

  it('proyek baru: nama wajib, catatan ikut dikirim', async () => {
    api.createProject.mockResolvedValue({ ...PROJECT });
    render(<ProjectView project="new" {...props} />);
    const create = screen.getByText(COPY.create) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(COPY.nameLabel), { target: { value: 'Rumah Bekasi' } });
    fireEvent.change(screen.getByLabelText(COPY.notesLabel), {
      target: { value: '  sumber air PDAM ' },
    });
    fireEvent.click(create);
    await waitFor(() => expect(props.onCreated).toHaveBeenCalled());
    expect(api.createProject).toHaveBeenCalledWith('Rumah Bekasi', 'sumber air PDAM');
  });

  it('proyek ada: daftar konsultasi, mulai konsultasi di proyek, simpan catatan, hapus dengan konfirmasi', async () => {
    api.updateProject.mockResolvedValue({ ...PROJECT, notes: 'pakai HDPE' });
    api.deleteProject.mockResolvedValue(true);
    render(<ProjectView project={PROJECT} {...props} />);
    fireEvent.click(screen.getByText('Rumah 2 lantai'));
    expect(props.onOpenConversation).toHaveBeenCalledWith(PROJECT.conversations[0]);
    fireEvent.click(screen.getByText(COPY.newInProject));
    expect(props.onNewConversation).toHaveBeenCalledWith(PROJECT);
    fireEvent.change(screen.getByLabelText(COPY.notesLabel), { target: { value: 'pakai HDPE' } });
    fireEvent.click(screen.getByText(COPY.save));
    await waitFor(() => expect(screen.getByText(COPY.saved)).toBeDefined());
    expect(api.updateProject).toHaveBeenCalledWith(PROJECT.id, {
      name: 'Rumah Bekasi',
      notes: 'pakai HDPE',
    });
    fireEvent.click(screen.getByText(COPY.deleteProject));
    expect(screen.getByText(COPY.deleteConfirm)).toBeDefined();
    fireEvent.click(screen.getByText(COPY.deleteYes));
    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledWith(PROJECT.id));
  });
});

describe('ShareDialog', () => {
  it('buat tautan, tampilkan untuk disalin, cabut', async () => {
    api.fetchShareStatus.mockResolvedValue({ active: false, createdAt: null });
    api.createShare.mockResolvedValue('https://ai.pralon.co.id/shared?t=abc');
    api.revokeShare.mockResolvedValue(true);
    render(
      <ShareDialog
        recommendationId={'R'.repeat(26)}
        onClose={() => undefined}
        formatDate={() => '19 OKT'}
      />,
    );
    await waitFor(() => expect(api.fetchShareStatus).toHaveBeenCalled());
    fireEvent.click(screen.getByText(COPY.shareCreate));
    await waitFor(() =>
      expect(
        (screen.getByDisplayValue('https://ai.pralon.co.id/shared?t=abc') as HTMLInputElement)
          .readOnly,
      ).toBe(true),
    );
    // Mencabut diminta konfirmasi lebih dulu (P27-06): ia memutus tautan yang mungkin sudah dikirim.
    fireEvent.click(screen.getByText(COPY.shareRevoke));
    expect(screen.getByText(COPY.shareRevokeConfirm)).toBeDefined();
    fireEvent.click(screen.getByText(COPY.shareRevokeYes));
    await waitFor(() => expect(screen.getByText(COPY.shareRevoked)).toBeDefined());
    expect(screen.queryByDisplayValue('https://ai.pralon.co.id/shared?t=abc')).toBeNull();
  });

  it('batal mencabut: tautannya tetap ada', async () => {
    api.fetchShareStatus.mockResolvedValue({ active: false, createdAt: null });
    api.createShare.mockResolvedValue('https://ai.pralon.co.id/shared?t=abc');
    render(
      <ShareDialog
        recommendationId={'R'.repeat(26)}
        onClose={() => undefined}
        formatDate={() => '19 OKT'}
      />,
    );
    await waitFor(() => expect(api.fetchShareStatus).toHaveBeenCalled());
    fireEvent.click(screen.getByText(COPY.shareCreate));
    await screen.findByDisplayValue('https://ai.pralon.co.id/shared?t=abc');
    fireEvent.click(screen.getByText(COPY.shareRevoke));
    fireEvent.click(screen.getByText(COPY.cancel));
    expect(api.revokeShare).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('https://ai.pralon.co.id/shared?t=abc')).toBeDefined();
  });

  // Tokennya hanya diterima sekali dari server; kunjungan berikutnya tidak memegangnya lagi.
  it('tautan aktif dari kunjungan lalu: dikatakan apa adanya, bukan kotak kosong', async () => {
    api.fetchShareStatus.mockResolvedValue({ active: true, createdAt: '2026-10-19T00:00:00.000Z' });
    render(
      <ShareDialog
        recommendationId={'R'.repeat(26)}
        onClose={() => undefined}
        formatDate={() => '19 Oktober 2026'}
      />,
    );
    await waitFor(() => expect(screen.getByText(COPY.shareLost)).toBeDefined());
    expect(screen.getByText(`${COPY.shareActive} 19 Oktober 2026`)).toBeDefined();
    expect(screen.getByText(COPY.shareRecreate)).toBeDefined();
    expect(screen.queryByLabelText(COPY.shareLinkLabel)).toBeNull();
  });
});

describe('SharedSolutionPage', () => {
  it('tautan dicabut atau tanpa token: pesan jujur, tanpa solusi', async () => {
    api.fetchShared.mockResolvedValue('not_found');
    window.history.replaceState(null, '', '/shared?t=abc');
    render(<SharedSolutionPage />);
    await waitFor(() => expect(screen.getByText(COPY.sharedNotFound)).toBeDefined());
    expect(screen.getByText(COPY.sharedNotFoundTitle)).toBeDefined();
    expect(api.fetchShared).toHaveBeenCalledWith('abc');
  });

  // P27-06: gagal memuat bukan jalan buntu — ada tombol untuk mencoba lagi.
  it('gagal memuat: judul, alasan, dan tombol coba lagi yang benar-benar memanggil ulang', async () => {
    api.fetchShared.mockResolvedValue('error');
    window.history.replaceState(null, '', '/shared?t=abc');
    render(<SharedSolutionPage />);
    await waitFor(() => expect(screen.getByText(COPY.sharedErrorTitle)).toBeDefined());
    fireEvent.click(screen.getByText(COPY.sharedRetry));
    await waitFor(() => expect(api.fetchShared).toHaveBeenCalledTimes(2));
  });

  it('tanpa token di alamat: tidak memanggil server sama sekali', async () => {
    window.history.replaceState(null, '', '/shared');
    render(<SharedSolutionPage />);
    await waitFor(() => expect(screen.getByText(COPY.sharedNotFoundTitle)).toBeDefined());
    expect(api.fetchShared).not.toHaveBeenCalled();
  });
});
