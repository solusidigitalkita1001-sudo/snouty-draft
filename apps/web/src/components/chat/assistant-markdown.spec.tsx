/**
 * Markdown asisten: yang dipaku adalah (1) tebal/daftar benar-benar menjadi elemen, bukan
 * tanda bintang yang ikut tampil, dan (2) HTML/skrip dari model TIDAK pernah dirender —
 * bukan sekadar "tidak terlihat". Markdown yang rusak harus tetap tampil sebagai teks.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AssistantMarkdown } from './assistant-markdown';

const html = (text: string) => render(<AssistantMarkdown text={text} />).container;

describe('AssistantMarkdown', () => {
  it('paragraf polos dan beberapa paragraf', () => {
    const c = html('Satu.\n\nDua.');
    expect(c.querySelectorAll('p')).toHaveLength(2);
    expect(c.querySelectorAll('p')[0]?.textContent).toBe('Satu.');
    expect(c.querySelectorAll('p')[1]?.textContent).toBe('Dua.');
  });

  it('**tebal** dan *miring* menjadi elemen, tandanya hilang', () => {
    const c = html('Singkatnya, **PVC itu kaku**, sedangkan *HDPE lentur*.');
    expect(c.querySelector('strong')?.textContent).toBe('PVC itu kaku');
    expect(c.querySelector('em')?.textContent).toBe('HDPE lentur');
    expect(c.textContent).not.toContain('**');
  });

  it('daftar bullet dan bernomor, termasuk tebal di dalam butir', () => {
    const c = html(
      '**PVC**\n- Kaku.\n- **Cocok** untuk instalasi tetap.\n\n1. Satu\n2. Dua\n3. Tiga',
    );
    expect(c.querySelectorAll('ul > li')).toHaveLength(2);
    expect(c.querySelectorAll('ol > li')).toHaveLength(3);
    expect(c.querySelector('ul > li strong')?.textContent).toBe('Cocok');
  });

  it('judul apa pun menjadi label kecil yang sama (h3), bukan h1 artikel', () => {
    const c = html('# Besar\n\n### Perbedaan utama\n\nisi');
    expect(c.querySelectorAll('h1')).toHaveLength(0);
    expect(c.querySelectorAll('h3')).toHaveLength(2);
  });

  it('HTML mentah dan skrip tidak dirender — tidak ada elemen, tidak ada atribut', () => {
    const c = html(
      'Halo <script>window.__x=1</script><img src=x onerror="alert(1)"> <b onclick="x()">tebal</b> selesai',
    );
    expect(c.querySelector('script')).toBeNull();
    expect(c.querySelector('img')).toBeNull();
    expect(c.querySelector('b')).toBeNull();
    expect(c.innerHTML).not.toContain('onerror');
    expect(c.innerHTML).not.toContain('onclick');
    expect(c.textContent).toContain('Halo');
    expect(c.textContent).toContain('selesai');
  });

  it('tautan dan gambar Markdown dibuang, teksnya tetap', () => {
    const c = html('Lihat [katalog](https://evil.example) dan ![x](https://evil.example/x.png).');
    expect(c.querySelector('a')).toBeNull();
    expect(c.querySelector('img')).toBeNull();
    expect(c.textContent).toContain('Lihat katalog dan');
  });

  it('Markdown rusak / belum lengkap tetap tampil sebagai teks, tidak melempar', () => {
    const c = html('Singkatnya, **PVC itu kaku\n- butir tanpa\n1. campur *miring');
    expect(c.textContent).toContain('PVC itu kaku');
    expect(c.textContent).toContain('butir tanpa');
  });

  it('tabel GFM dirender sebagai <table> di dalam pembungkus yang menggulir (P16-05)', () => {
    const { container } = render(
      <AssistantMarkdown
        text={'| Aspek | **PVC** | **HDPE** |\n| --- | --- | --- |\n| Bentuk | kaku | lentur |'}
      />,
    );
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(container.querySelectorAll('th')).toHaveLength(3);
    expect(container.querySelector('td')?.textContent).toBe('Bentuk');
    expect(table?.parentElement?.className).toContain('tableWrap');
  });

  it('blok kode tidak menjadi <pre> yang melebar', () => {
    const c = html('```\nukuran 3/4\n```');
    expect(c.querySelector('pre')).toBeNull();
    expect(c.querySelector('code')?.textContent).toContain('ukuran 3/4');
  });

  it('teks panjang (ratusan butir) tetap terender utuh', () => {
    const items = Array.from({ length: 300 }, (_, i) => `- butir **${i}**`).join('\n');
    const c = html(`Pembuka.\n\n${items}\n\nPenutup.`);
    expect(c.querySelectorAll('li')).toHaveLength(300);
    expect(c.textContent?.endsWith('Penutup.')).toBe(true);
  });
});
