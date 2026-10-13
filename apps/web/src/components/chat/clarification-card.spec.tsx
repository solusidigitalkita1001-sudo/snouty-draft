/** Review putaran 3, 6b: "Lebih dari X" tombol terakhir; isian jumlah baru tampil setelah dipilih. */
import type { ClarificationQuestion } from '@snouty/shared-types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClarificationCard } from './chat-workspace';

const BATHROOMS: ClarificationQuestion = {
  id: 'fixtures.bathrooms',
  question: 'Ada berapa kamar mandi?',
  options: ['1', '2', '3', '4'],
  inputs: [
    {
      key: 'value',
      group: 'Lebih dari 4',
      label: 'Jumlah',
      unit: '',
      required: true,
      min: 0,
      max: 500,
    },
  ],
  allowUnknown: true,
};

describe('ClarificationCard — pilihan + isian', () => {
  it('"Lebih dari 4" sesudah pilihan angka, sebelum "Belum tahu"; isian tersembunyi dulu', () => {
    render(<ClarificationCard questions={[BATHROOMS]} active onSubmit={vi.fn()} />);
    const labels = screen.getAllByRole('button', { pressed: false }).map((b) => b.textContent);
    expect(labels.slice(0, 6)).toEqual(['1', '2', '3', '4', 'Lebih dari 4', 'Belum tahu']);
    expect(screen.queryByPlaceholderText('Jumlah')).toBeNull();
  });

  it('memilih "Lebih dari 4" menampilkan isian Jumlah; memilih angka menutupnya lagi', () => {
    render(<ClarificationCard questions={[BATHROOMS]} active onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lebih dari 4' }));
    expect(screen.getByPlaceholderText('Jumlah')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.queryByPlaceholderText('Jumlah')).toBeNull();
  });
});
