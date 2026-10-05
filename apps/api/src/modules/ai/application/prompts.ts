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
  'Klasifikasikan intent pesan pengguna (Bahasa Indonesia) ke TEPAT SATU label:',
  '- REQUIREMENT_STATEMENT: menyatakan kebutuhan bangunan/instalasi (lantai, kamar mandi, sumber air, dsb.) untuk pertama kali.',
  '- REQUIREMENT_MUTATION: mengubah kebutuhan yang sudah tercatat ("ganti jadi 3 lantai", "tambah 1 kamar mandi"). Hanya bila hasExistingRequirements=true.',
  '- CLARIFICATION_ANSWER: menjawab pertanyaan klarifikasi sistem ("toren atap", "2", "belum tahu"). Hanya bila hasExistingRequirements=true.',
  '- PRODUCT_LOOKUP: bertanya tentang produk pipa/fitting atau sifatnya — ukuran, bahan, standar, tekanan, sambungan, perbedaan antar produk ("apa bedanya PVC dan HDPE?", "ada ukuran 3/4?").',
  '- EXPLANATION_REQUEST: minta alasan atas hasil/angka yang sudah diberikan sistem ("kenapa pipa utamanya 1 inci?").',
  '- COMPETITOR_QUESTION: menyebut atau membandingkan merek lain (Rucika, Wavin, Maspion, dsb.).',
  '- OUT_OF_SCOPE: sapaan, basa-basi, atau topik di luar perpipaan.',
  '- CLARIFICATION_NEEDED: maksudnya tidak bisa ditentukan.',
  'Sertakan confidence 0–1. Bila ragu antara mengubah kebutuhan dan sekadar bertanya, beri confidence rendah.',
].join('\n');

export const PRODUCT_QUESTION_SYSTEM_PROMPT = [
  'Pesan pengguna adalah pertanyaan tentang produk pipa. Petakan — jangan jawab.',
  'productQuery: nama atau keluarga produk yang disebut (mis. "PVC AW", "HDPE"); null bila tidak ada.',
  'aspect: salah satu label yang diizinkan skema, atau null bila pertanyaannya tidak menunjuk aspek tertentu.',
  'size: ukuran yang ditanyakan (mis. "3/4") hanya untuk size_availability; selain itu null.',
  'Jangan menebak aspek terdekat. Jangan menambahkan fakta apa pun.',
].join('\n');

export const TITLE_SYSTEM_PROMPT = [
  'Buat judul singkat (maksimum 8 kata) untuk percakapan konsultasi pipa ini, Bahasa Indonesia.',
  'Tanpa tanda kutip, tanpa tanda baca akhir.',
].join('\n');

/**
 * Prosa penjelas pasca-perhitungan. Perhatikan apa yang TIDAK ada di sini: tidak ada
 * ambang ukuran, tidak ada aturan sizing, tidak ada definisi provenance. Semuanya sudah
 * selesai sebelum prompt ini dipanggil — model hanya menjelaskan hasilnya.
 *
 * Larangan "jangan tambahkan angka" ditulis di sini sebagai instruksi tugas, tetapi
 * **penegakannya ada di kode** (`checkProse`, invarian REC-1). Kalau ia hanya hidup di
 * prompt, ia dianggap tidak ada.
 */
export const PROSE_SYSTEM_PROMPT = [
  'Anda menjelaskan hasil perhitungan sistem perpipaan yang SUDAH selesai dihitung.',
  'Tugas Anda menulis penjelasan, bukan menghitung. Seluruh angka sudah final.',
  '',
  'Aturan keluaran:',
  '- Kembalikan JSON: {"headline": string, "body": string}.',
  '- Bahasa Indonesia, kalimat pendek, nada tenang dan praktis.',
  '- JANGAN menambahkan angka, ukuran, panjang, tekanan, atau kuantitas apa pun yang',
  '  tidak ada di data yang diberikan. Termasuk perkiraan, pembulatan, dan rentang.',
  '- Jangan menyebut merek selain Pralon.',
  '- Jangan menjanjikan kelayakan teknis atau sertifikasi.',
  '',
  'headline: satu kalimat ringkas. body: 2–4 kalimat yang menjelaskan mengapa ukuran',
  'itu dipilih, memakai alasan teknis yang sudah disediakan.',
].join('\n');
