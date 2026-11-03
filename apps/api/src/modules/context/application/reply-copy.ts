/**
 * Balasan tetap untuk giliran yang TIDAK masuk ruas ekstraksi maupun lookup produk.
 *
 * Sebelum ini intent-intent tersebut menutup giliran tanpa sepatah kata — pengguna yang
 * menyapa atau bertanya "kenapa" melihat gelembungnya sendiri tanpa jawaban. Kalimat di
 * sini deterministik dan tidak memuat fakta teknis apa pun; dengan model aktif, LLM yang
 * akan menyapa dan bertanya balik secara wajar, tetapi kartunya tetap sama.
 *
 * Dua bahasa (Fase 15): teks hidup di kode per bahasa, bukan diterjemahkan model.
 */
import {
  DEFAULT_LOCALE,
  type Intent,
  type Locale,
  type RequirementFieldPath,
} from '@snouty/shared-types';
import { FIELD_LABEL, FIELD_LABEL_EN } from '../domain/requirement-labels.js';

export const REPLY_COPY = {
  /** Sapaan atau di luar topik perpipaan — arahkan, jangan diam. */
  OUT_OF_SCOPE:
    'Halo! Saya SNOUTY dari Pralon, siap bantu merencanakan pipa air bersih sekaligus pembuangan untuk bangunan Anda. Ceritakan saja bangunannya — berapa lantai, berapa kamar mandi, dan airnya dari mana — atau tanyakan produk Pralon.',
  /** "Kenapa pipa utamanya 1 inci?" — dasar perhitungannya ada di solusi, bukan dikarang di sini. */
  EXPLANATION_REQUEST:
    'Dasar setiap angka ada di solusi: buka "Tampilkan detail teknis" untuk melihat aturan dan masukan yang dipakai. Bila ada yang terasa keliru, ubah kebutuhannya dan solusinya dihitung ulang.',
  /** Model ragu — bertanya lebih murah daripada mengubah kebutuhan yang tidak diminta. */
  CLARIFICATION_NEEDED:
    'Maaf, saya belum menangkap maksudnya. Bisa dijelaskan sedikit lebih rinci — apakah ini tentang kebutuhan bangunan Anda, atau tentang produk tertentu?',
} as const satisfies Partial<Record<Intent, string>>;

const REPLY_COPY_EN: Readonly<Record<RepliedIntent, string>> = {
  OUT_OF_SCOPE:
    'Hello! I am SNOUTY from Pralon, here to help plan both the clean-water and the drainage pipes for your building. Just tell me about it — how many floors, how many bathrooms, and where the water comes from — or ask about Pralon products.',
  EXPLANATION_REQUEST:
    'Every number in the solution has its basis: open "Show technical details" to see the rules and inputs used. If something looks off, change the requirement and the solution is recalculated.',
  CLARIFICATION_NEEDED:
    'Sorry, I did not quite catch that. Could you explain a little more — is this about your building needs, or about a specific product?',
};

/**
 * Pesan pembuka tanpa satu pun fakta kebutuhan ("mau nanya2 dong", "boleh tanya?") yang model
 * beri label pernyataan kebutuhan. Bukan intent tersendiri — ditentukan dari hasil ekstraksi
 * yang kosong — jadi tidak masuk `REPLY_COPY` yang berkunci intent.
 */
export const OPENER_REPLY =
  'Silakan, tanyakan saja. Saya bisa membantu merencanakan pipa air bersih dan pembuangan untuk bangunan Anda — sebutkan jumlah lantai, kamar mandi, dan sumber airnya — atau menjawab pertanyaan tentang produk Pralon.';

const OPENER_REPLY_EN =
  'Go ahead and ask. I can help plan the clean-water and drainage pipes for your building — tell me the number of floors, bathrooms, and the water source — or answer questions about Pralon products.';

export type RepliedIntent = keyof typeof REPLY_COPY;

export function replyFor(intent: Intent, locale: Locale = DEFAULT_LOCALE): string | null {
  if (!(intent in REPLY_COPY)) return null;
  const key = intent as RepliedIntent;
  return locale === 'en' ? REPLY_COPY_EN[key] : REPLY_COPY[key];
}

/**
 * Model tidak menjawab pada waktunya dan pemahaman pun tidak punya bacaan yang cukup (P28-02).
 *
 * Sebelum ini jawabannya "Maaf, saya belum menangkap maksudnya" — dan itu tidak benar:
 * pertanyaannya mungkin sejelas-jelasnya, yang terjadi adalah gilirannya kehabisan waktu.
 * Pengguna yang disuruh memperjelas kalimat yang sudah jelas akan menulis ulang hal yang sama
 * dan gagal lagi; yang benar adalah mengatakan apa yang sesungguhnya terjadi.
 */
export function modelBusyReply(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en'
    ? 'Sorry — I ran out of time working that one out. Please send it again in a moment; it usually goes through on the second try.'
    : 'Maaf, giliran ini kehabisan waktu di saya — bukan karena pertanyaannya. Coba kirim lagi sebentar lagi, biasanya percobaan kedua langsung jalan.';
}

/** "Kenapa 1 inci?" sebelum ada solusi: belum ada angka yang bisa dijelaskan. */
export function explanationBeforeSolution(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en'
    ? 'Sizes are only calculated once you press **Compose recommendation**; every figure then comes with the basis of its calculation.'
    : 'Ukurannya baru dihitung setelah Anda menekan **Susun rekomendasi**; setiap angka nanti disertai dasar perhitungannya.';
}

/**
 * Giliran yang tidak mengubah apa pun di kebutuhan: pesannya tidak punya tempat di hitungan
 * (mis. "air kotor dan air bekas dipisah"), jadi ringkasan kebutuhan yang sama persis tidak
 * dikirim ulang kata demi kata — balasan identik dua giliran berturut-turut adalah penanda bot
 * yang paling kentara (produksi 2026-10-26).
 */
export function requirementUnchangedReply(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en'
    ? 'Your requirement stands as shown in the panel. Which part would you like to change or ask about?'
    : 'Kebutuhan Anda tetap tercatat seperti di panel. Bagian mana yang mau diubah atau ditanyakan?';
}

/**
 * Pengguna meminta dilanjutkan atas kebutuhan yang memang sudah dihitung giliran ini ("oke
 * lanjut", "udah, itung aja"). Produksi 2026-11-03: karena tidak ada data yang berubah, giliran
 * itu dijawab "kebutuhan Anda tetap tercatat" — pengguna menyuruh maju, dan dijawab seolah ia
 * tidak mengatakan apa-apa.
 */
export function computingNowReply(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en'
    ? 'Working out the pipe sizes and the product list now.'
    : 'Oke, ukuran pipa dan daftar produknya saya hitung sekarang.';
}

/**
 * Keterangan satu lantai yang tidak menurunkan totalnya (P33-05). Giliran ini memang tidak mengubah
 * kebutuhan, tetapi "kebutuhan Anda tetap tercatat" menyembunyikan alasannya — dan di produksi
 * 2026-11-03 angka yang sama justru turun diam-diam. Yang diucapkan: totalnya utuh, bagian yang
 * disebut itu bagian darinya, dan kalau totalnya memang berubah tinggal disebut.
 */
export function perFloorTotalReply(
  kept: { readonly path: RequirementFieldPath; readonly total: number; readonly perFloor: number },
  locale: Locale = DEFAULT_LOCALE,
): string {
  const rest = kept.total - kept.perFloor;
  const label = locale === 'en' ? FIELD_LABEL_EN[kept.path] : FIELD_LABEL[kept.path];
  // Label kartu ditulis berawalan huruf besar ("Kamar mandi"); di tengah kalimat ia huruf kecil.
  const noun = label.charAt(0).toLowerCase() + label.slice(1);
  return locale === 'en'
    ? `On record there are ${kept.total} ${noun} for the whole building, so ${kept.perFloor} on that floor means ${rest} on the other floors. If the total itself changed, just say the number.`
    : `Yang tercatat ${kept.total} ${noun} untuk seluruh bangunan, jadi ${kept.perFloor} di lantai itu berarti ${rest} lagi di lantai lain. Kalau totalnya yang berubah, sebutkan saja angkanya.`;
}

/**
 * Angka yang terbaca tetapi tidak punya parameter di kasus ini. Produksi 2026-10-26: "toren 2000
 * liter di atap" lalu "ukuran bangunannya 10 x 20 meter" di kasus sumur ke tandon mendapat kalimat
 * "Yang masih saya perlukan: …" yang sama persis dua giliran berturut-turut, tanpa sepatah kata
 * bahwa angkanya tidak dipakai.
 */
export function valueWithoutPlaceReply(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en'
    ? 'That figure has no place in this calculation, so I have not used it.'
    : 'Angka itu tidak punya tempat di hitungan kasus ini, jadi belum saya pakai.';
}

/** "Mana perhitungannya?" atas kasus yang diserahkan ke tim teknis — alasannya dari kartu kebijakan. */
export function explanationHandedOff(
  reasons: readonly string[],
  locale: Locale = DEFAULT_LOCALE,
): string {
  const why = reasons[0] ?? '';
  return locale === 'en'
    ? `There is no automatic calculation for this case: ${why} The Pralon technical team works out the figures. To calculate the clean-water part yourself, change the installation type to clean water and press **Compose recommendation**.`
    : `Untuk kasus ini belum ada hitungan otomatis: ${why} Angkanya dihitung tim teknis Pralon. Kalau mau saya hitung bagian air bersihnya saja, ubah jenis instalasinya menjadi air bersih lalu tekan **Susun rekomendasi**.`;
}

export function openerReply(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en' ? OPENER_REPLY_EN : OPENER_REPLY;
}

/**
 * Pesan yang dikenali DI LUAR urusan pipa ("cuaca hari ini gimana?", "bisa kirim ke bandung?"):
 * bukan sapaan, jadi pembuka "Halo! Saya SNOUTY…" terbaca seperti percakapan di-reset (audit live
 * 2026-10-08). Katakan batasnya, lalu tawarkan yang bisa dibantu.
 */
/**
 * "Lu bisa ngitung ga sih?", "kamu bisa apa aja?": ditanya apa yang bisa dikerjakan di sini.
 * Dijawab teks tetap — di produksi 2026-10-26 pertanyaan ini memakan 24,8 detik lewat model, dan
 * di tengah percakapan produk malah mendapat ulangan persis jawaban sebelumnya.
 */
const CAPABILITY_REPLY =
  'Bisa. Yang saya kerjakan di sini: menghitung ukuran pipa dan kebutuhan materialnya untuk satu bangunan atau jalur — rumah, gedung, kolam, sumur, irigasi, sampai saluran pembuangan — lalu menyusunnya jadi daftar produk Pralon beserta gambar jalurnya. Soal produk dan pemakaiannya juga bisa saya jawab. Ceritakan bangunannya, atau tanya produknya langsung.';

const CAPABILITY_REPLY_EN =
  'Yes. What I do here: work out pipe sizes and the material needed for a building or a run — a house, a tall building, a pond, a well, irrigation, or a drainage line — and turn that into a list of Pralon products with a drawing of the route. Questions about the products and how they are used, I answer too. Tell me about the building, or ask about a product.';

export function capabilityReply(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en' ? CAPABILITY_REPLY_EN : CAPABILITY_REPLY;
}

/**
 * Topik yang baru saja dijawab ditanya lagi: jawabannya tidak dikirim ulang kata demi kata
 * (produksi 2026-10-26, dua pertanyaan pompa berurutan).
 */
const REPEATED_TOPIC_REPLY =
  'Itu yang saya jelaskan di jawaban sebelumnya. Bagian mana yang mau saya perjelas, atau ada angka dari lapangan yang mau dipakai?';

const REPEATED_TOPIC_REPLY_EN =
  'That is what the previous answer covers. Which part would you like me to go into, or is there a figure from site you want to use?';

/**
 * "udah, itung" sementara masih ada data yang ditunggu: yang ditunggu disebut namanya. Dulu
 * balasannya "Kebutuhan Anda tetap tercatat seperti di panel. Bagian mana yang mau diubah atau
 * ditanyakan?" — pertanyaan balik kepada orang yang baru saja meminta hitungannya (produksi
 * 2026-10-26, proyek renovasi ruko).
 */
export function missingForCalculationReply(
  missing: readonly RequirementFieldPath[],
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  if (missing.length === 0) return null;
  const en = locale === 'en';
  const labels = missing.map((path) =>
    (en ? FIELD_LABEL_EN[path] : FIELD_LABEL[path]).toLowerCase(),
  );
  const and = en ? 'and' : 'dan';
  const list =
    labels.length === 1
      ? labels[0]!
      : `${labels.slice(0, -1).join(', ')} ${and} ${labels[labels.length - 1]}`;
  return en
    ? `To work it out I still need ${list}. The options are below, or type the numbers directly.`
    : `Untuk menghitungnya saya masih perlu ${list}. Pilihannya ada di bawah, atau ketik angkanya langsung.`;
}

export function repeatedTopicReply(
  locale: Locale = DEFAULT_LOCALE,
  /**
   * Ada kebutuhan atau solusi yang tercatat. Tanpa itu, "ada angka dari lapangan yang mau
   * dipakai?" menawarkan sesuatu yang tidak punya tempat: di produksi 2026-11-03 pertanyaan
   * ketahanan kimia yang diulang dijawab begitu, di percakapan yang tidak punya hitungan apa pun.
   */
  hasCase = false,
): string {
  if (!hasCase) {
    return locale === 'en'
      ? 'That is what the previous answer covers. Which part would you like me to go into?'
      : 'Itu yang saya jelaskan di jawaban sebelumnya. Bagian mana yang mau saya perjelas?';
  }
  return locale === 'en' ? REPEATED_TOPIC_REPLY_EN : REPEATED_TOPIC_REPLY;
}

/**
 * Pertanyaan dagang KEDUA berturut-turut ("ada stok di surabaya?" lalu "minimal order berapa?"):
 * jawabannya sama persis, jadi pagar pengulangan menyalakan kalimat topik — yang menutup dengan
 * "ada angka dari lapangan yang mau dipakai?", kalimat milik jawaban teknik (produksi 2026-11-03).
 * Pertanyaannya memang baru; yang diulang hanya kenyataan bahwa angkanya bukan di sini.
 */
export function commercialAgainReply(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en'
    ? 'That sits with the Pralon team as well — I do not hold those figures. Tell me about the building and I can work out the pipe it needs right now.'
    : 'Itu juga ada di tim Pralon, sama seperti tadi — angkanya tidak saya pegang. Kalau bangunannya Anda sebutkan, kebutuhan pipanya bisa saya hitung sekarang.';
}

const OUT_OF_TOPIC_REPLY =
  'Itu di luar yang bisa saya bantu di sini — saya khusus soal pipa dan instalasi air Pralon. Untuk pengiriman, harga, atau urusan pesanan, tim Pralon yang bisa membantu. Kalau ada kebutuhan pipa atau pertanyaan produk, tinggal tulis.';

const OUT_OF_TOPIC_REPLY_EN =
  'That is outside what I can help with here — I cover Pralon pipes and water installations only. For delivery, pricing, or order matters, the Pralon team can help. If you have a piping need or a product question, just write it.';

export function outOfTopicReply(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en' ? OUT_OF_TOPIC_REPLY_EN : OUT_OF_TOPIC_REPLY;
}

/**
 * Penawaran, stok, pengiriman, minimum order, garansi, dan klaim: tim Pralon yang memegangnya.
 * Dikatakan apa adanya, lalu disebut apa yang memang bisa dikerjakan di sini — pertanyaan garansi
 * yang dijawab kuliah umur pakai, dan permintaan penawaran yang dijawab ajakan bertanya, membuat
 * penanyanya mengulang pertanyaan yang sama (produksi 2026-11-02).
 */
export function commercialReply(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en'
    ? 'Quotations, stock, delivery, and warranty sit with the Pralon team — I do not hold those figures. What I can do here is work out pipe sizes and the material a building needs, and answer product questions.'
    : 'Penawaran, stok, pengiriman, dan garansi ada di tim Pralon — angkanya tidak saya pegang. Yang bisa saya kerjakan di sini: menghitung ukuran pipa dan kebutuhan materialnya, serta menjawab pertanyaan produk.';
}

/**
 * Permintaan yang murah atau hemat (P32-17, keputusan pemilik 2026-11-02): dijawab apa adanya,
 * tanpa angka. Ukuran tidak diturunkan dari hasil hitungan — itu yang membuat airnya kecil; yang
 * bisa dihemat kelas pipa sesuai fungsinya (ENG-013: AW di jalur bertekanan, D di buangan) dan
 * jalur yang pendek. Harga sendiri tidak ditampilkan di sini (OQ-03).
 */
export function savingReply(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en'
    ? 'On cost: the pipe size itself is not where to save — a size below the calculation is what makes the water weak at the top floor. What does save money is using the right class for each line (pressure class only where the water is pushed, drainage class on the waste side) and keeping the main run short and straight, since every bend is another fitting. The prices and the offer come from the Pralon team.'
    : 'Soal hemat: yang tidak bisa dihemat justru ukuran pipanya — ukuran di bawah hasil hitungan itulah yang membuat air di lantai atas kecil. Yang bisa dihemat: kelas pipa sesuai fungsi jalurnya (kelas bertekanan hanya di jalur yang airnya didorong, kelas buangan di sisi pembuangan) dan jalur utama yang pendek serta lurus, karena setiap tikungan berarti satu fitting lagi. Harga dan penawarannya dari tim Pralon.';
}

/**
 * Toren yang disebut tanpa letaknya: letak toren menentukan tekanan, jadi ia ditanyakan. Di
 * produksi 2026-11-02 "airnya dari sumur bor pakai toren" dijawab "Kebutuhan Anda tetap tercatat
 * seperti di panel" — jawaban pengguna seolah tidak terbaca.
 */
export function tankLocationQuestion(locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en'
    ? 'Is the tank on the roof or on the ground? That decides the pressure at the outlets.'
    : 'Torennya di atap atau di bawah? Dari situ tekanan di titik airnya saya hitung.';
}
