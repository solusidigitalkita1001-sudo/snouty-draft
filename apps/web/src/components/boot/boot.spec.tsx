/**
 * Layar muat pertama (P27-05, pemilik 2026-10-23: "loading snouty untuk awal2 masuk"). Dua sifat
 * yang dipaku: ia menutupi isinya sampai semua pekerjaan selesai, dan ia tidak pernah menyandera —
 * API yang diam pun akhirnya melepaskan aplikasinya.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BootGate, useBootStep, type BootStep } from './boot';

function Ready({ steps }: { readonly steps: readonly BootStep[] }) {
  const markReady = useBootStep();
  useEffect(() => {
    for (const step of steps) markReady(step);
  }, [steps, markReady]);
  return <p>ruang konsultasi</p>;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('BootGate', () => {
  it('menahan layar sampai seluruh pekerjaan selesai', async () => {
    render(
      <BootGate>
        <Ready steps={['session']} />
      </BootGate>,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('SNOUTY')).toBeTruthy();
  });

  it('semua selesai → layar muat hilang, isinya tampil', async () => {
    render(
      <BootGate>
        <Ready steps={['session', 'onboarding']} />
      </BootGate>,
    );
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.getByText('ruang konsultasi')).toBeTruthy();
  });

  it('rute tanpa onboarding cukup menunggu sesi', async () => {
    render(
      <BootGate steps={['session']}>
        <Ready steps={['session']} />
      </BootGate>,
    );
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('tidak ada yang melapor: menyerah setelah batas waktu, aplikasinya tetap terbuka', async () => {
    render(
      <BootGate>
        <p>ruang konsultasi</p>
      </BootGate>,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(5_000);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.getByText('ruang konsultasi')).toBeTruthy();
  });

  it('isinya tetap dirender di balik layar muat, bukan ditunda', () => {
    render(
      <BootGate>
        <p>ruang konsultasi</p>
      </BootGate>,
    );
    expect(screen.getByText('ruang konsultasi')).toBeTruthy();
  });

  it('di luar gate, menandai selesai tidak meledak', () => {
    render(<Ready steps={['session']} />);
    expect(screen.getByText('ruang konsultasi')).toBeTruthy();
  });
});
