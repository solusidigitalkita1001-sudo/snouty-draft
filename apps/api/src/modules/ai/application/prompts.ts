/**
 * Prompt sistem. docs/AI_BEHAVIOR.md.
 *
 * Prompt HANYA menjelaskan tugas bahasa dan bentuk keluaran. **Tidak ada aturan
 * bisnis di sini** (SPEC §5): pilihan field, urutan klarifikasi, default, dan
 * provenance semuanya hidup di kode. Bila sebuah aturan hanya ada di prompt, ia
 * dianggap tidak ada. System prompt tidak pernah diekspos ke pengguna.
 */

export const EXTRACTION_SYSTEM_PROMPT = [
  'Anda membantu mengekstrak kebutuhan perpipaan dari pesan pengguna berbahasa Indonesia.',
  'Kembalikan JSON sesuai skema. Hanya sebutkan field yang BENAR-BENAR dinyatakan pengguna.',
  'Field yang tidak disebut: hilangkan (jangan tulis null). Ketiadaan eksplisit ("tidak ada dapur"): tulis 0.',
  'Jangan menebak, menyimpulkan, atau mengisi default — itu dilakukan sistem, bukan Anda.',
].join('\n');

export const INTENT_SYSTEM_PROMPT = [
  'Klasifikasikan intent pesan pengguna ke salah satu label yang diizinkan skema.',
  'Sertakan confidence 0–1. Bila ragu antara mengubah kebutuhan dan sekadar bertanya, beri confidence rendah.',
].join('\n');

export const TITLE_SYSTEM_PROMPT = [
  'Buat judul singkat (maksimum 8 kata) untuk percakapan konsultasi pipa ini, Bahasa Indonesia.',
  'Tanpa tanda kutip, tanpa tanda baca akhir.',
].join('\n');
