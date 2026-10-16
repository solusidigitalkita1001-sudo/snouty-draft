/** P22-01: contoh rumah di layar sambutan — bergambar, bahasa pengguna, satu klik memilih. */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HouseExamples, type HouseExampleItem } from './house-examples';

const examples: readonly HouseExampleItem[] = [
  {
    id: 'subsidi_36',
    image: 'house1',
    label: { id: 'Rumah subsidi tipe 36', en: 'Subsidised house, type 36' },
    summary: { id: '1 lantai, 1 kamar mandi', en: '1 floor, 1 bathroom' },
  },
  {
    id: 'rumah_2_lantai',
    image: 'house2',
    label: { id: 'Rumah 2 lantai', en: 'Two-storey house' },
    summary: { id: '2 lantai, 2 kamar mandi', en: '2 floors, 2 bathrooms' },
  },
];

describe('HouseExamples', () => {
  it('menampilkan tiap contoh dalam bahasa pengguna dan mengirim id saat dipilih', () => {
    const onChoose = vi.fn();
    const { getByText, container } = render(
      <HouseExamples
        examples={examples}
        locale="id"
        title="Atau mulai dari contoh rumah"
        disabled={false}
        onChoose={onChoose}
      />,
    );
    expect(getByText('Atau mulai dari contoh rumah')).toBeTruthy();
    expect(getByText('1 lantai, 1 kamar mandi')).toBeTruthy();
    expect(container.querySelectorAll('svg use').length).toBe(2);
    fireEvent.click(getByText('Rumah 2 lantai'));
    expect(onChoose).toHaveBeenCalledWith('rumah_2_lantai');
  });

  it('bahasa Inggris memakai label Inggris; daftar kosong tidak merender apa pun', () => {
    const { getByText } = render(
      <HouseExamples
        examples={examples}
        locale="en"
        title="Start from an example"
        disabled
        onChoose={vi.fn()}
      />,
    );
    expect(getByText('Subsidised house, type 36')).toBeTruthy();
    const { container } = render(
      <HouseExamples examples={[]} locale="id" title="x" disabled={false} onChoose={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
