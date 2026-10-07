/**
 * Teks asisten sebagai Markdown ringan — tebal, miring, daftar, judul kecil, kode sebaris.
 *
 * Mengapa whitelist, bukan "semua yang Markdown bisa": teks ini ditulis model. HTML mentah
 * tidak pernah dirender (`skipHtml`), tautan dan gambar dibuang isinya saja yang tinggal
 * (`unwrapDisallowed`) — tautan buatan model adalah tautan yang tidak ada yang menjamin.
 * Tidak ada `dangerouslySetInnerHTML` di jalur ini; react-markdown membangun elemen React.
 *
 * Judul apa pun (h1–h6) dirender sebagai label kecil yang sama: ini percakapan, bukan artikel.
 */
import type { ComponentPropsWithoutRef } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './assistant-markdown.module.css';

const ALLOWED = [
  'p',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'code',
  'br',
  'blockquote',
  'hr',
  // Tabel GFM: perbandingan yang diminta "dalam bentuk tabel" (P16-05). Dibungkus agar
  // menggulir ke samping di layar sempit, bukan melebarkan gelembung.
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

const Label = (props: ComponentPropsWithoutRef<'h3'>) => <h3 className={styles.label} {...props} />;

const COMPONENTS: Components = {
  h1: Label,
  h2: Label,
  h3: Label,
  h4: Label,
  h5: Label,
  h6: Label,
  // Blok kode tidak diminta di percakapan; bila model tetap membuatnya, isinya tampil
  // sebagai kode sebaris — tanpa <pre> yang melebar dan menggulir horizontal.
  pre: ({ children }) => <>{children}</>,
  code: (props) => <code className={styles.code} {...props} />,
  table: (props) => (
    <div className={styles.tableWrap}>
      <table className={styles.table} {...props} />
    </div>
  ),
};

export function AssistantMarkdown({ text }: { readonly text: string }) {
  return (
    <div className={styles.md}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        allowedElements={ALLOWED}
        unwrapDisallowed
        skipHtml
        components={COMPONENTS}
      >
        {text}
      </Markdown>
    </div>
  );
}
